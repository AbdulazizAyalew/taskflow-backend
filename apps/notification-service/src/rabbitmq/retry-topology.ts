import { connect } from 'amqplib';

export interface NotificationRetryTopology {
  eventExchange: string;
  retryExchange: string;
  retryQueue: string;
  deadLetterExchange: string;
  deadLetterQueue: string;
  deadLetterRoutingKey: string;
}

export async function setupRetryTopology(
  url: string,
  topology: NotificationRetryTopology,
): Promise<void> {
  const connection = await connect(url);
  const channel = await connection.createChannel();

  try {
    await channel.assertExchange(topology.eventExchange, 'topic', {
      durable: true,
    });
    await channel.assertExchange(topology.retryExchange, 'direct', {
      durable: true,
    });
    await channel.assertQueue(topology.retryQueue, {
      durable: true,
      deadLetterExchange: topology.eventExchange,
    });
    await channel.bindQueue(
      topology.retryQueue,
      topology.retryExchange,
      'laptop_created',
    );

    await channel.assertExchange(topology.deadLetterExchange, 'direct', {
      durable: true,
    });
    await channel.assertQueue(topology.deadLetterQueue, { durable: true });
    await channel.bindQueue(
      topology.deadLetterQueue,
      topology.deadLetterExchange,
      topology.deadLetterRoutingKey,
    );
  } finally {
    await channel.close();
    await connection.close();
  }
}
