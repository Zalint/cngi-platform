const {
    toSQLDate,
    formatDate,
    isValidDate,
    getCurrentSQLDate,
    daysDifference,
    isPastDate,
    isFutureDate,
} = require('../../../src/utils/dateHelpers');

describe('toSQLDate', () => {
    test.each([
        ['2024-05-12', '2024-05-12'],
        ['12-05-2024', '2024-05-12'],
        ['12/05/2024', '2024-05-12'],
        ['12/05/24', '2024-05-12'],
        ['12/05/99', '1999-05-12'],
    ])('toSQLDate(%p) -> %p', (input, expected) => {
        expect(toSQLDate(input)).toBe(expected);
    });

    test('retourne null pour falsy', () => {
        expect(toSQLDate('')).toBe(null);
        expect(toSQLDate(null)).toBe(null);
        expect(toSQLDate(undefined)).toBe(null);
    });

    test('retourne null pour chaîne non parseable', () => {
        expect(toSQLDate('pas-une-date')).toBe(null);
    });

    test('parse fallback via Date()', () => {
        expect(toSQLDate('2024-01-15T10:00:00Z')).toBe('2024-01-15');
    });
});

describe('isValidDate', () => {
    test('vrai pour formats supportés', () => {
        expect(isValidDate('2024-05-12')).toBe(true);
        expect(isValidDate('12/05/2024')).toBe(true);
    });
    test('faux pour vide / invalide', () => {
        expect(isValidDate('')).toBe(false);
        expect(isValidDate('hello')).toBe(false);
    });
});

describe('formatDate', () => {
    test('formatte DD/MM/YYYY par défaut', () => {
        expect(formatDate('2024-05-12')).toBe('12/05/2024');
    });
    test('formatte DD-MM-YYYY', () => {
        expect(formatDate('2024-05-12', 'DD-MM-YYYY')).toBe('12-05-2024');
    });
    test('formatte DD/MM/YY', () => {
        expect(formatDate('2024-05-12', 'DD/MM/YY')).toBe('12/05/24');
    });
    test('formatte YYYY-MM-DD', () => {
        expect(formatDate('2024-05-12', 'YYYY-MM-DD')).toBe('2024-05-12');
    });
    test('chaîne vide si invalide', () => {
        expect(formatDate('')).toBe('');
        expect(formatDate('abc')).toBe('');
    });
});

describe('getCurrentSQLDate', () => {
    test('retourne une date YYYY-MM-DD', () => {
        expect(getCurrentSQLDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('daysDifference', () => {
    test('différence en jours', () => {
        expect(daysDifference('2024-01-01', '2024-01-10')).toBe(9);
    });
    test('valeur absolue', () => {
        expect(daysDifference('2024-01-10', '2024-01-01')).toBe(9);
    });
});

describe('isPastDate / isFutureDate', () => {
    test('date passée', () => {
        expect(isPastDate('2000-01-01')).toBe(true);
        expect(isFutureDate('2000-01-01')).toBe(false);
    });
    test('date future', () => {
        expect(isFutureDate('2999-01-01')).toBe(true);
        expect(isPastDate('2999-01-01')).toBe(false);
    });
});
