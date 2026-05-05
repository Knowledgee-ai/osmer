import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env.test', override: true });
