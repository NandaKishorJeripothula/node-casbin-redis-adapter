import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { newEnforcer } from 'casbin';
import { authz } from './authorization.middleware';
import { NodeRedisAdapter } from './adapter';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(authz(async () => {
    const model = join(__dirname, 'casbin_conf/model.conf');
    const adapter = await NodeRedisAdapter.newAdapter({ host: "127.0.0.1", port: 6379 })
    const enforcer = await newEnforcer(model, adapter);
    //const enforcer = await newEnforcer(model,join(__dirname, 'casbin_conf/policy.csv'));
    await enforcer.loadPolicy();
    
    return enforcer;
  }));
  await app.listen(3000);
}
bootstrap();
