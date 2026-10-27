module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/lib/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
