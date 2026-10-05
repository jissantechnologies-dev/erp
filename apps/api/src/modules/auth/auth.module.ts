import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

/**
 * JwtModule is re-exported because JwtAuthGuard is registered globally in
 * AppModule and is therefore instantiated in that module's context — it needs
 * JwtService visible there, not only inside this module.
 *
 * Registered with `{}` deliberately: secrets are passed per sign/verify call,
 * so access and refresh tokens can use different ones.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
