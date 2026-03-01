import { Injectable } from '@nestjs/common';
import { IStackPlugin } from '../interfaces/stack-plugin.interface';
import { NodeJsPlugin } from '../plugins/nodejs.plugin';
import { LaravelPlugin } from '../plugins/laravel.plugin';
import { PhpGenericPlugin } from '../plugins/php-generic.plugin';
import { ExpressPlugin } from '../plugins/express.plugin';
import { NextJsPlugin } from '../plugins/nextjs.plugin';
import { WordPressPlugin } from '../plugins/wordpress.plugin';

@Injectable()
export class PluginRegistryService {
  private plugins: Map<string, IStackPlugin> = new Map();

  constructor(
    private readonly nodejsPlugin: NodeJsPlugin,
    private readonly laravelPlugin: LaravelPlugin,
    private readonly phpGenericPlugin: PhpGenericPlugin,
    private readonly expressPlugin: ExpressPlugin,
    private readonly nextjsPlugin: NextJsPlugin,
    private readonly wordpressPlugin: WordPressPlugin,
  ) {
    this.registerPlugin('NODEJS', this.nodejsPlugin);
    this.registerPlugin('LARAVEL', this.laravelPlugin);
    this.registerPlugin('PHP_GENERIC', this.phpGenericPlugin);
    this.registerPlugin('EXPRESS', this.expressPlugin);
    this.registerPlugin('NEXTJS', this.nextjsPlugin);
    this.registerPlugin('WORDPRESS', this.wordpressPlugin);
  }

  private registerPlugin(techStack: string, plugin: IStackPlugin): void {
    this.plugins.set(techStack, plugin);
  }

  getPlugin(techStack: string): IStackPlugin | undefined {
    return this.plugins.get(techStack);
  }

  getAllPlugins(): Array<{ techStack: string; plugin: IStackPlugin }> {
    return Array.from(this.plugins.entries()).map(([techStack, plugin]) => ({
      techStack,
      plugin,
    }));
  }

  getSupportedTechStacks(): string[] {
    return Array.from(this.plugins.keys());
  }
}
