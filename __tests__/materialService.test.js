import {
    normalizeMaterial,
    getMaterialOrSubMaterialLabel,
    getMaterialColor,
    fetchAllActiveMaterials,
    fetchCollectMaterials,
    fetchClassifyRootMaterials,
    fetchClassifySubMaterials,
    isValidMaterialDocument
} from '../services/materialService';
import { getDocs } from 'firebase/firestore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../firebase', () => ({
    db: {},
    storage: {},
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
}));

describe('materialService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('normalizes material documents correctly', () => {
        const rawDoc = {
            name: 'Plásticos',
            names: { es: 'Plásticos', en: 'Plastics' },
            status: 'active',
            color: '#D8D238',
            photoUrl: 'https://example.com/plasticos.png',
            hasSubMaterials: true,
            workflows: ['both'],
            sortOrder: 1,
        };

        const normalized = normalizeMaterial(rawDoc, 'plasticos', 'es');
        expect(normalized.id).toBe('plasticos');
        expect(normalized.label).toBe('Plásticos');
        expect(normalized.color).toBe('#D8D238');
        expect(normalized.photoUrl).toBe('https://example.com/plasticos.png');
        expect(normalized.hasSubMaterials).toBe(true);

        const normalizedEn = normalizeMaterial(rawDoc, 'plasticos', 'en');
        expect(normalizedEn.label).toBe('Plastics');
    });

    it('fetches and filters collect materials (workflow both or empty)', async () => {
        const mockDocs = [
            {
                id: 'plasticos',
                data: () => ({
                    name: 'Plásticos',
                    names: { es: 'Plásticos', en: 'Plastics' },
                    status: 'active',
                    color: '#D8D238',
                    workflows: ['both'],
                    sortOrder: 1,
                    parentId: null,
                }),
            },
            {
                id: 'descarte',
                data: () => ({
                    name: 'Descarte',
                    names: { es: 'Descarte', en: 'Discard' },
                    status: 'active',
                    color: '#5B1466',
                    workflows: ['classify'],
                    sortOrder: 2,
                    parentId: null,
                }),
            },
            {
                id: 'pet_natural',
                data: () => ({
                    name: 'PET Natural',
                    names: { es: 'PET Natural', en: 'Natural PET' },
                    status: 'active',
                    color: '#EADA4A',
                    parentId: 'plasticos',
                }),
            },
        ];

        getDocs.mockResolvedValueOnce({
            docs: mockDocs,
        });

        const collectMaterials = await fetchCollectMaterials('es');
        expect(collectMaterials.length).toBe(1);
        expect(collectMaterials[0].id).toBe('plasticos');
        expect(collectMaterials[0].label).toBe('Plásticos');
    });

    it('fetches and filters classify root materials (workflow both or classify)', async () => {
        const mockDocs = [
            {
                id: 'plasticos',
                data: () => ({
                    name: 'Plásticos',
                    names: { es: 'Plásticos', en: 'Plastics' },
                    status: 'active',
                    color: '#D8D238',
                    workflows: ['both'],
                    sortOrder: 1,
                    parentId: null,
                }),
            },
            {
                id: 'descarte',
                data: () => ({
                    name: 'Descarte',
                    names: { es: 'Descarte', en: 'Discard' },
                    status: 'active',
                    color: '#5B1466',
                    workflows: ['classify'],
                    sortOrder: 2,
                    parentId: null,
                }),
            },
        ];

        getDocs.mockResolvedValueOnce({
            docs: mockDocs,
        });

        const classifyRoots = await fetchClassifyRootMaterials('es');
        expect(classifyRoots.length).toBe(2);
        expect(classifyRoots[0].id).toBe('plasticos');
        expect(classifyRoots[1].id).toBe('descarte');
    });

    it('fetches submaterials for a specific parent category', async () => {
        const mockSubs = [
            {
                id: 'pet_natural',
                data: () => ({
                    name: 'PET Natural',
                    names: { es: 'PET Natural', en: 'Natural PET' },
                    status: 'active',
                    color: '#EADA4A',
                    parentId: 'plasticos',
                    sortOrder: 0,
                }),
            },
        ];

        getDocs.mockResolvedValueOnce({
            docs: mockSubs,
        });

        const subs = await fetchClassifySubMaterials('plasticos', 'en');
        expect(subs.length).toBe(1);
        expect(subs[0].id).toBe('pet_natural');
        expect(subs[0].label).toBe('Natural PET');
    });

    it('resolves labels and colors from cache', () => {
        expect(getMaterialOrSubMaterialLabel('plasticos', 'es')).toBe('Plásticos');
        expect(getMaterialColor('plasticos')).toBe('#D8D238');
    });

    it('validates schema and ignores malformed/invalid documents', () => {
        // Valid document
        expect(isValidMaterialDocument({ name: 'Valid', status: 'active' }, 'valid_id')).toBe(true);

        // Missing id
        expect(isValidMaterialDocument({ name: 'No ID', status: 'active' }, '')).toBe(false);
        expect(isValidMaterialDocument(null, 'some_id')).toBe(false);

        // Inactive or archived
        expect(isValidMaterialDocument({ name: 'Inactive', status: 'inactive' }, 'inact')).toBe(false);
        expect(isValidMaterialDocument({ name: 'Archived', status: 'active', archived: true }, 'arch')).toBe(false);
        expect(isValidMaterialDocument({ name: 'ActiveFalse', status: 'active', active: false }, 'act_f')).toBe(false);

        // Missing both name and names
        expect(isValidMaterialDocument({ status: 'active' }, 'no_name')).toBe(false);
        expect(isValidMaterialDocument({ name: '   ', status: 'active' }, 'empty_name')).toBe(false);
        expect(isValidMaterialDocument({ names: {}, status: 'active' }, 'empty_names_obj')).toBe(false);

        // Valid with bilingual names even if name string is empty
        expect(isValidMaterialDocument({ names: { es: 'Vidrio' }, status: 'active' }, 'vidrio')).toBe(true);
    });

    it('ignores malformed documents when fetching materials from Firestore', async () => {
        const mockDocs = [
            {
                id: 'valid_material',
                data: () => ({
                    name: 'Papel',
                    names: { es: 'Papel', en: 'Paper' },
                    status: 'active',
                    color: '#4C52E7',
                }),
            },
            {
                id: 'corrupt_no_name',
                data: () => ({
                    status: 'active',
                }),
            },
            {
                id: 'archived_item',
                data: () => ({
                    name: 'Viejo',
                    status: 'active',
                    archived: true,
                }),
            },
            {
                id: 'inactive_item',
                data: () => ({
                    name: 'Pausado',
                    status: 'inactive',
                }),
            },
        ];

        getDocs.mockResolvedValueOnce({
            docs: mockDocs,
        });

        const activeMaterials = await fetchAllActiveMaterials('es');
        expect(activeMaterials.length).toBe(1);
        expect(activeMaterials[0].id).toBe('valid_material');
    });
});
