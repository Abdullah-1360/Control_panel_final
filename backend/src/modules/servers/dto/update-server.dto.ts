import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateServerDto } from './create-server.dto';

// Update DTO allows partial updates, but platformType cannot be changed
export class UpdateServerDto extends PartialType(
  OmitType(CreateServerDto, ['platformType'] as const),
) {}
