process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.JWT_SECRET = 'amrutam_test_jwt_secret_key_32chars_long!';
process.env.JWT_REFRESH_SECRET = 'amrutam_test_refresh_secret_key_32chars!';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL = 'fatal'; // Silent logs during tests
