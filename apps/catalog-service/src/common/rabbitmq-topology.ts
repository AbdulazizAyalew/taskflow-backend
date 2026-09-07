import { connect } from 'amqplib';

export interface CatalogRabbitmqTopology {
  deadLetterExchange: string;
  deadLetterQueue: string;
  deadLetterRoutingKey: string;
}

export async function setupDeadLetterTopology(
  url: string,
  topology: CatalogRabbitmqTopology,
): Promise<void> {
  const connection = await connect(url);
  const channel = await connection.createChannel();

  try {
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
