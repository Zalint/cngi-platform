process.env.JWT_SECRET = 'test_jwt_secret_for_unit_tests_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Silence les logs attendus pendant les tests — les chemins d'erreur des
// contrôleurs/middlewares appellent console.error/log, ce qui pollue la sortie.
// Les assertions portent sur le status/body, pas sur les logs.
const noop = () => {};
console.error = noop;
console.log = noop;
console.warn = noop;
