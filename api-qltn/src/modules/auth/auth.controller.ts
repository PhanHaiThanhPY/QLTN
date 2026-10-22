import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService, type UserProfile } from '../users/users.service';
import { AuthService, type AuthTokens, type ClientMeta } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/** Stricter limit on credential endpoints (per client IP). */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

const clientMeta = (req: Request): ClientMeta => ({ userAgent: req.get('user-agent'), ip: req.ip });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng tên đăng nhập/email và mật khẩu' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.login(dto.username, dto.password, clientMeta(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới (token cũ bị thu hồi)' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, clientMeta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thu hồi refresh token của phiên hiện tại' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ loggedOut: true }> {
    await this.auth.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu của chính mình (đăng xuất mọi phiên)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { changed: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    const profile = await this.users.getProfile(user.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }
}
