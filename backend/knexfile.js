import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try loading .env from multiple locations
const envPath1 = path.resolve(__dirname, '../.env');
const envPath2 = path.resolve(__dirname, '../../.env');
const envPath3 = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath1 });
dotenv.config({ path: envPath2 });
dotenv.config({ path: envPath3 });
// Debug: log what we loaded
console.log('DATABASE_URL available:', !!process.env.DATABASE_URL);
// Determine connection method: use DATABASE_URL if available, otherwise use individual credentials
const getConnection = () => {
    if (process.env.DATABASE_URL) {
        console.log('Using DATABASE_URL connection');
        return process.env.DATABASE_URL;
    }
    console.log('Using individual DB credentials');
    // Fallback to individual credentials
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'school_management_dev',
    };
};
const config = {
    development: {
        client: 'pg',
        connection: getConnection(),
        migrations: {
            directory: './src/database/migrations',
            extension: 'ts',
        },
        seeds: {
            directory: './src/database/seeds',
            extension: 'ts',
        },
    },
    staging: {
        client: 'pg',
        connection: getConnection(),
        migrations: {
            directory: './src/database/migrations',
            extension: 'ts',
        },
        seeds: {
            directory: './src/database/seeds',
            extension: 'ts',
        },
    },
    production: {
        client: 'pg',
        connection: getConnection(),
        migrations: {
            directory: './dist/database/migrations',
            extension: 'js',
        },
        seeds: {
            directory: './dist/database/seeds',
            extension: 'js',
        },
    },
};
export default config;
//# sourceMappingURL=knexfile.js.map