import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function clearQueues() {
  console.log('🗑️  Clearing Redis job queues...\n');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  try {
    // Clear metrics collection queue
    const metricsQueue = new Queue('metrics-collection', { connection });
    
    // Remove all repeatable jobs
    const repeatableJobs = await metricsQueue.getRepeatableJobs();
    console.log(`Found ${repeatableJobs.length} repeatable jobs`);
    
    for (const job of repeatableJobs) {
      await metricsQueue.removeRepeatableByKey(job.key);
      console.log(`✅ Removed repeatable job: ${job.key}`);
    }

    // Clear all jobs
    await metricsQueue.drain();
    console.log('✅ Drained all pending jobs');

    await metricsQueue.clean(0, 1000, 'completed');
    await metricsQueue.clean(0, 1000, 'failed');
    await metricsQueue.clean(0, 1000, 'delayed');
    console.log('✅ Cleaned all job states');

    await metricsQueue.close();
    await connection.quit();

    console.log('\n✨ All Redis queues cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing queues:', error);
    await connection.quit();
    throw error;
  }
}

clearQueues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
