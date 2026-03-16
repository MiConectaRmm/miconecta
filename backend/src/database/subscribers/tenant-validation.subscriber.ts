import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

@EventSubscriber()
export class TenantValidationSubscriber implements EntitySubscriberInterface {

  private readonly TENANT_ENTITIES = [
    'Ticket', 'Alert', 'Device', 'ClientUser', 'RemoteSession',
    'ConsentRecord', 'Notification', 'FileAttachment',
    'LgpdRequest', 'ReportSchedule',
  ];

  beforeInsert(event: InsertEvent<any>) {
    this.validate(event.entity, event.metadata?.name, 'INSERT');
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.validate(event.entity, event.metadata?.name, 'UPDATE');
  }

  private validate(entity: any, entityName: string | undefined, operation: string) {
    if (!entity || !entityName) return;
    if (!this.TENANT_ENTITIES.includes(entityName)) return;

    if ('tenantId' in entity && !entity.tenantId) {
      const msg = `SECURITY: ${operation} em ${entityName} sem tenant_id!`;
      console.error(`[TenantValidation] ${msg}`);
      throw new Error(msg);
    }
  }
}
