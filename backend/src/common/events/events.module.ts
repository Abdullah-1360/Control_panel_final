import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { EventStreamController } from './event-stream.controller';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Use this instance throughout the app
      wildcard: false,
      // Set the delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` if you want to emit the newListener event
      newListener: false,
      // Set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // The maximum amount of listeners that can be assigned to an event
      maxListeners: 100,
      // Show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: true,
      // Disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),
  ],
  controllers: [EventStreamController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
