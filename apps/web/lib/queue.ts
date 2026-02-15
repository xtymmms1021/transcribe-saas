import { Queue } from 'bullmq';
import { redis } from './redis';

export const transcribeQueue = new Queue('transcribe', { connection: redis });
