const {
    isValidEmail,
    validatePassword,
    validateUsername,
    isValidRole,
    isValidProjectStatus,
    isValidPercentage,
    validateProjectData,
    validateProjectDataForUpdate,
    validateUserData,
    validateStructureData,
    sanitizeString,
    PASSWORD_RULES,
} = require('../../../src/utils/validators');

describe('isValidEmail', () => {
    test.each([
        ['a@b.co', true],
        ['user.name+tag@example.fr', true],
        ['no-at-sign.com', false],
        ['double@@a.com', false],
        ['missing@tld', false],
        ['', false],
    ])('isValidEmail(%p) -> %p', (email, expected) => {
        expect(isValidEmail(email)).toBe(expected);
    });
});

describe('validatePassword', () => {
    test('rejette mot de passe vide', () => {
        const r = validatePassword('');
        expect(r.valid).toBe(false);
        expect(r.message).toMatch(/requis/i);
    });
    test('rejette si manque majuscule', () => {
        const r = validatePassword('abcdef12');
        expect(r.valid).toBe(false);
        expect(r.failed).toContain('Au moins une majuscule (A-Z)');
    });
    test('rejette si manque chiffre', () => {
        const r = validatePassword('Abcdefgh');
        expect(r.valid).toBe(false);
        expect(r.failed).toContain('Au moins un chiffre (0-9)');
    });
    test('rejette si trop court', () => {
        const r = validatePassword('Ab1');
        expect(r.valid).toBe(false);
        expect(r.failed).toContain('Au moins 8 caractères');
    });
    test('accepte mot de passe valide', () => {
        const r = validatePassword('Abcdef12');
        expect(r.valid).toBe(true);
        expect(r.failed).toEqual([]);
    });
    test('n\'exige PAS de caractère spécial', () => {
        expect(validatePassword('Password1').valid).toBe(true);
    });
    test('PASSWORD_RULES exporte 4 règles', () => {
        expect(PASSWORD_RULES).toHaveLength(4);
    });
});

describe('validateUsername', () => {
    test('rejette vide', () => {
        expect(validateUsername('').valid).toBe(false);
    });
    test('rejette < 3 caractères', () => {
        expect(validateUsername('ab').valid).toBe(false);
    });
    test('rejette caractères spéciaux', () => {
        expect(validateUsername('user-name').valid).toBe(false);
        expect(validateUsername('user name').valid).toBe(false);
    });
    test('accepte lettres/chiffres/underscore', () => {
        expect(validateUsername('user_1').valid).toBe(true);
        expect(validateUsername('ABCabc_123').valid).toBe(true);
    });
});

describe('isValidRole', () => {
    ['admin', 'utilisateur', 'directeur', 'superviseur', 'commandement_territorial', 'lecteur', 'auditeur']
        .forEach(r => test(`accepte ${r}`, () => expect(isValidRole(r)).toBe(true)));
    test('refuse autre', () => {
        expect(isValidRole('root')).toBe(false);
        expect(isValidRole('')).toBe(false);
    });
});

describe('isValidProjectStatus', () => {
    ['demarrage', 'en_cours', 'termine', 'retard', 'annule']
        .forEach(s => test(`accepte ${s}`, () => expect(isValidProjectStatus(s)).toBe(true)));
    test('refuse autre', () => {
        expect(isValidProjectStatus('fini')).toBe(false);
    });
});

describe('isValidPercentage', () => {
    test.each([
        [0, true],
        [50, true],
        [100, true],
        [-1, false],
        [101, false],
        ['50', false],
        [null, false],
    ])('isValidPercentage(%p) -> %p', (v, expected) => {
        expect(isValidPercentage(v)).toBe(expected);
    });
});

describe('validateProjectData (création)', () => {
    const base = { title: 'Projet', structure_id: 1 };
    test('valide avec les champs minimaux', () => {
        expect(validateProjectData(base).valid).toBe(true);
    });
    test('requiert titre', () => {
        const r = validateProjectData({ ...base, title: '  ' });
        expect(r.valid).toBe(false);
        expect(r.errors).toContain('Titre du projet requis');
    });
    test('requiert structure_id', () => {
        const r = validateProjectData({ title: 'x' });
        expect(r.errors).toContain('Structure requise');
    });
    test('rejette statut invalide', () => {
        const r = validateProjectData({ ...base, status: 'pouet' });
        expect(r.errors).toContain('Statut invalide');
    });
    test('rejette pourcentage hors bornes', () => {
        const r = validateProjectData({ ...base, progress_percentage: 150 });
        expect(r.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Pourcentage/)]));
    });
    test('rejette dates invalides', () => {
        const r = validateProjectData({ ...base, start_date: 'pas une date' });
        expect(r.errors).toContain('Date de début invalide');
    });
    test('rejette priorité invalide', () => {
        expect(validateProjectData({ ...base, priority: 'low' }).valid).toBe(false);
    });
    test('accepte priorité valide', () => {
        expect(validateProjectData({ ...base, priority: 'urgente' }).valid).toBe(true);
    });
    test('rejette project_type invalide', () => {
        expect(validateProjectData({ ...base, project_type: 'bidon' }).valid).toBe(false);
    });
});

describe('validateProjectDataForUpdate', () => {
    test('objet vide est valide (update partielle)', () => {
        expect(validateProjectDataForUpdate({}).valid).toBe(true);
    });
    test('rejette titre vide explicitement fourni', () => {
        expect(validateProjectDataForUpdate({ title: '   ' }).valid).toBe(false);
    });
    test('autorise null sur dates', () => {
        expect(validateProjectDataForUpdate({ start_date: null, end_date: null }).valid).toBe(true);
    });
    test('autorise project_type = "" (reset)', () => {
        expect(validateProjectDataForUpdate({ project_type: '' }).valid).toBe(true);
    });
    test('rejette statut invalide', () => {
        expect(validateProjectDataForUpdate({ status: 'nope' }).valid).toBe(false);
    });
});

describe('validateUserData', () => {
    test('création complète OK', () => {
        const r = validateUserData({
            username: 'john_doe',
            password: 'Password1',
            email: 'j@d.com',
            role: 'admin',
        });
        expect(r.valid).toBe(true);
    });
    test('création : role requis', () => {
        const r = validateUserData({ username: 'john', password: 'Password1' });
        expect(r.errors).toContain('Rôle requis');
    });
    test('création : email invalide', () => {
        const r = validateUserData({ username: 'john', password: 'Password1', email: 'bad', role: 'admin' });
        expect(r.errors).toContain('Email invalide');
    });
    test('update : pas de password requis', () => {
        const r = validateUserData({ email: 'new@a.com' }, true);
        expect(r.valid).toBe(true);
    });
    test('update : rôle invalide rejeté', () => {
        expect(validateUserData({ role: 'hacker' }, true).valid).toBe(false);
    });
});

describe('validateStructureData', () => {
    test('valide si name + code majuscules', () => {
        expect(validateStructureData({ name: 'DG', code: 'DG01' }).valid).toBe(true);
    });
    test('rejette code en minuscules', () => {
        expect(validateStructureData({ name: 'X', code: 'abc' }).valid).toBe(false);
    });
    test('rejette nom vide', () => {
        expect(validateStructureData({ name: '', code: 'AA' }).valid).toBe(false);
    });
    test('rejette code vide', () => {
        expect(validateStructureData({ name: 'N', code: '' }).valid).toBe(false);
    });
});

describe('sanitizeString', () => {
    test('supprime < et >', () => {
        expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });
    test('trim les espaces', () => {
        expect(sanitizeString('  hi  ')).toBe('hi');
    });
    test('passthrough non-string', () => {
        expect(sanitizeString(42)).toBe(42);
        expect(sanitizeString(null)).toBe(null);
    });
});
