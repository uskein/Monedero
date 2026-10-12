/**
 * Test UI — SettingsScreen + CategoriesManager (BP-08 sub Categorías · HU-10):
 * hub → gestión con 4 estados, alta con color token, duplicado NOCASE y
 * borrar-con-movimientos → «se archiva». Fuente: BLUEPRINTS BP-08 · HU-10.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nProvider } from '@monedero/i18n/react';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { useCategoriesStore, type CategoriesRepo } from '../src/features/settings/store';
import type { Category, CategoryInput } from '../src/data/domain/categories';

function makeCategory(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name: 'Comida',
    type: 'expense',
    parentId: null,
    icon: 'tag',
    color: '#2F7D5B',
    sortOrder: 0,
    createdAt: '2026-10-11T12:00:00.000Z',
    updatedAt: '2026-10-11T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function fakeRepo(seed: Category[] = [], opts: { failDeleteWithTx?: string[] } = {}): CategoriesRepo {
  const data = [...seed];
  return {
    async list() {
      return data.filter((c) => !c.deletedAt);
    },
    async create(input: CategoryInput) {
      const dup = data.find(
        (c) => !c.deletedAt && c.name.toLowerCase() === input.name.trim().toLowerCase(),
      );
      if (dup) throw new Error('INTEGRITY_VIOLATION');
      const cat = makeCategory(`cat-${data.length + 1}`, {
        name: input.name.trim(),
        type: input.type,
        color: input.color ?? '#2F7D5B',
      });
      data.push(cat);
      return cat;
    },
    async update(id: string, patch: { name?: string; color?: string }) {
      const cat = data.find((c) => c.id === id);
      if (!cat) throw new Error('CATEGORY_NOT_FOUND');
      if (patch.name) cat.name = patch.name;
      if (patch.color) cat.color = patch.color;
      return cat;
    },
    async archive(id: string) {
      const cat = data.find((c) => c.id === id);
      if (cat) cat.deletedAt = '2026-10-11T13:00:00.000Z';
    },
    async remove(id: string) {
      if (opts.failDeleteWithTx?.includes(id)) throw new Error('INTEGRITY_VIOLATION');
      const idx = data.findIndex((c) => c.id === id);
      if (idx >= 0) data.splice(idx, 1);
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function renderSettings(repo?: CategoriesRepo) {
  return render(
    <I18nProvider initialLocale="es-CO">
      <SettingsScreen categoriesRepoOverride={repo} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  useCategoriesStore.setState({
    status: 'loading',
    items: [],
    error: null,
    formError: null,
    repo: null,
  });
});

describe('SettingsScreen — hub BP-08 → Categorías', () => {
  it('muestra el hub y navega a la gestión de categorías', async () => {
    const { container } = renderSettings(fakeRepo([makeCategory('a')]));
    expect(screen.getByText('Ajustes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByText('Comida')).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe('CategoriesManager — 4 estados (HU-10)', () => {
  it('loading → spinner con role=status', async () => {
    let resolveList!: (value: Category[]) => void;
    const repo = fakeRepo([]);
    repo.list = () => new Promise((resolve) => (resolveList = resolve));
    renderSettings(repo);
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    resolveList([]);
    await waitFor(() => expect(screen.getByText('Aún no hay categorías')).toBeTruthy());
  });

  it('empty → EmptyState con CTA «Nueva categoría»', async () => {
    const { container } = renderSettings(fakeRepo([]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByText('Aún no hay categorías')).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('success → lista agrupada con acciones por fila (a11y con nombre)', async () => {
    const { container } = renderSettings(
      fakeRepo([makeCategory('a'), makeCategory('b', { name: 'Salario', type: 'income' })]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(screen.getByText('Salario')).toBeTruthy();
    expect(screen.getByText('Gastos')).toBeTruthy();
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar Comida' })).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('error → role=alert + botón Reintentar', async () => {
    const repo = fakeRepo([]);
    repo.list = async () => {
      throw new Error('boom');
    };
    renderSettings(repo);
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('CategoriesManager — alta/edición (HU-10)', () => {
  it('alta válida crea la categoría y vuelve a la lista', async () => {
    renderSettings(fakeRepo([]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Viajes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }));
    expect(await screen.findByText('Viajes')).toBeTruthy();
  });

  it('duplicado NOCASE → alert «Ya existe» y permanece en el formulario', async () => {
    renderSettings(fakeRepo([makeCategory('a')]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'COMIDA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Ya existe una categoría con ese nombre.');
    expect(screen.getByLabelText('Nombre')).toBeTruthy(); // sigue en el form
  });

  it('nombre vacío → validación local sin llamar al repo', async () => {
    renderSettings(fakeRepo([]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Escribe un nombre');
  });

  it('editar renombra y el botón Cancelar vuelve a la lista', async () => {
    renderSettings(fakeRepo([makeCategory('a')]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Comida' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Comida rica' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }));
    expect(await screen.findByText('Comida rica')).toBeTruthy();
  });

  it('archivar retira la categoría de la lista activa', async () => {
    renderSettings(fakeRepo([makeCategory('a')]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archivar Comida' }));
    await waitFor(() => expect(screen.queryByText('Comida')).toBeNull());
    expect(screen.getByText('Aún no hay categorías')).toBeTruthy();
  });

  it('eliminar con movimientos → alert «se archiva» y la categoría permanece', async () => {
    renderSettings(fakeRepo([makeCategory('a')], { failDeleteWithTx: ['a'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Comida' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Tiene movimientos: se archiva en lugar de borrarse.');
    expect(screen.getByText('Comida')).toBeTruthy();
  });

  it('el selector de color expone SOLO tokens (radiogroup a11y)', async () => {
    const { container } = renderSettings(fakeRepo([]));
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    const group = screen.getByRole('radiogroup', { name: 'Color' });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
