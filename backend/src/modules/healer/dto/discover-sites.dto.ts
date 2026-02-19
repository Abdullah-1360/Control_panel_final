import { IsString } from 'class-validator';

export class DiscoverSitesDto {
  @IsString()
  serverId!: string;
}
