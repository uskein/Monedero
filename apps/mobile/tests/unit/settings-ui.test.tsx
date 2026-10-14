/**
 * Test UI — SettingsScreen + CategoriesManager móvil (BP-08 · HU-10):
 * hub → gestión con 4 estados, alta con color token, duplicado NOCASE y
 * borrar-con-movimientos → «se archiva».
 * RNTL v14: `await render` y `await fireEvent` son async (React 19 concurrent).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { SettingsScreen, CategoriesManager } from '../../src/ui/screens/SettingsScreen';
import { useCategoriesStore, type CategoriesRepo } from '../../src/state/categories.store';
import type { Category, CategoryInput } from '../../src/core/domain/category';

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

function renderSettings(repo: CategoriesRepo) {
  return render(
    <I18nProvider initialLocale="es-CO">
      <SettingsScreen categories={repo} />
    </I18nProvider>,
  );
}

function resetStore() {
  useCategoriesStore.setState({
    status: 'loading',
    items: [],
    error: null,
    formError: null,
    repo: null,
  });
}

beforeEach(resetStore);

describe('SettingsScreen móvil — hub BP-08 → Categorías', () => {
  it('muestra el hub y navega a la gestión', async () => {
    await renderSettings(fakeRepo([makeCategory('a')]));
    expect(screen.getByText('Ajustes')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    expect(await screen.findByText('Comida')).toBeTruthy();
  });
});

describe('CategoriesManager móvil — 4 estados (HU-10)', () => {
  it('empty → EmptyState con CTA «Nueva categoría»', async () => {
    await render(
      <I18nProvider initialLocale="es-CO">
        <CategoriesManager repo={fakeRepo([])} onBack={() => undefined} />
      </I18nProvider>,
    );
    expect(await screen.findByText('Aún no hay categorías')).toBeTruthy();
  });

  it('success → lista agrupada con acciones por fila (a11y con nombre)', async () => {
    await render(
      <I18nProvider initialLocale="es-CO">
        <CategoriesManager
          repo={fakeRepo([makeCategory('a'), makeCategory('b', { name: 'Salario', type: 'income' })])}
          onBack={() => undefined}
        />
      </I18nProvider>,
    );
    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(screen.getByText('Salario')).toBeTruthy();
    expect(screen.getByText('Gastos')).toBeTruthy();
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar Comida' })).toBeTruthy();
  });

  it('error → alert + botón Reintentar', async () => {
    const repo = fakeRepo([]);
    repo.list = async () => {
      throw new Error('boom');
    };
    await render(
      <I18nProvider initialLocale="es-CO">
        <CategoriesManager repo={repo} onBack={() => undefined} />
      </I18nProvider>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('CategoriesManager móvil — alta/edición (HU-10)', () => {
  it('alta válida crea la categoría y vuelve a la lista', async () => {
    await renderSettings(fakeRepo([]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Viajes');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar categoría' }));
    expect(await screen.findByText('Viajes')).toBeTruthy();
  });

  it('duplicado NOCASE → alert «Ya existe» y permanece en el formulario', async () => {
    await renderSettings(fakeRepo([makeCategory('a')]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'COMIDA');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar categoría' }));
    const alert = await screen.findByRole('alert');
    expect(alert.props.children).toContain('Ya existe una categoría con ese nombre.');
    expect(screen.getByLabelText('Nombre')).toBeTruthy(); // sigue en el form
  });

  it('nombre vacío → validación local sin tocar el repo', async () => {
    await renderSettings(fakeRepo([]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar categoría' }));
    // El Input expone el error como accessibilityHint + Text role=alert («⚠ …»).
    expect(screen.getByLabelText('Nombre').props.accessibilityHint).toContain('Escribe un nombre');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('editar renombra la categoría', async () => {
    await renderSettings(fakeRepo([makeCategory('a')]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Comida' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Comida rica');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar categoría' }));
    expect(await screen.findByText('Comida rica')).toBeTruthy();
  });

  it('archivar retira la categoría de la lista activa', async () => {
    await renderSettings(fakeRepo([makeCategory('a')]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Archivar Comida' }));
    await waitFor(() => expect(screen.queryByText('Comida')).toBeNull());
    expect(screen.getByText('Aún no hay categorías')).toBeTruthy();
  });

  it('eliminar con movimientos → alert «se archiva» y la categoría permanece', async () => {
    await renderSettings(fakeRepo([makeCategory('a')], { failDeleteWithTx: ['a'] }));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Eliminar Comida' }));
    const alert = await screen.findByRole('alert');
    expect(alert.props.children).toContain('Tiene movimientos: se archiva en lugar de borrarse.');
    expect(screen.getByText('Comida')).toBeTruthy();
  });

  it('el selector de color expone SOLO tokens (radiogroup)', async () => {
    await renderSettings(fakeRepo([]));
    await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Nueva categoría' }));
    // RN no marca accessible en contenedores con rol de grupo: se consulta por label.
    expect(screen.getByLabelText('Color')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(18); // 2 chips de tipo + 4 swatches + 12 iconos
  });
});
