import {
  Body, Controller, Get, Post, Req, Res, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { loginSchema, refreshSchema, registerTenantSchema } from '@erp/shared';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '../../common/decorators/permissions.decorator';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import type { TenantContext } from '../../prisma/tenant-context';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a workspace and its first Owner user' })
  async register(@Body(zodBody(registerTenantSchema)) dto: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.registerTenant(dto as never);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(zodBody(loginSchema)) dto: unknown,
    @Req() req: Request & { resolvedTenantSlug?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto as never, req.resolvedTenantSlug);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    // Prefer the httpOnly cookie; fall back to the body for non-browser clients.
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const token = fromCookie ?? refreshSchema.safeParse(body).data?.refreshToken;
    if (!token) throw new UnauthorizedException('No refresh token supplied');

    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user, their permissions and workspace' })
  me(@CurrentUser() ctx: TenantContext) {
    // Returns the full user record, not the bare token context, so the web app
    // can rehydrate its session on reload from this one call.
    return this.auth.currentUser(ctx);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86_400_000,
    });
  }
}
