import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { getAuth } from './auth';

const dynamicImport = new Function('modulePath', 'return import(modulePath)');

@Controller('auth')
export class AuthController {
  @All('/*')
  async handler(@Req() req: Request, @Res() res: Response) {
    const auth = await getAuth();
    const { toNodeHandler } = await dynamicImport('better-auth/node');
    return toNodeHandler(auth)(req, res);
  }
}
