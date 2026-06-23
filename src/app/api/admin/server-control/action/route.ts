import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { verifyAdminToken } from '@/lib/auth';

const ALLOWED_ACTIONS = ['restart', 'shutdown', 'reboot_app'] as const;
type AdminAction = typeof ALLOWED_ACTIONS[number];

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as any;
    const { action } = body as { action: unknown };

    if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action as AdminAction)) {
      return NextResponse.json({ error: 'Acción inválida o no especificada.' }, { status: 400 });
    }

    const typedAction = action as AdminAction;
    const platform = process.platform;
    const isProd = process.env.NODE_ENV === 'production';
    const runCmd = isProd ? 'npm start' : 'npm run dev';

    if (typedAction === 'shutdown') {
      // Software-level shutdown: Stop the Next.js process.
      // On Windows, close any active terminal window with these titles
      if (platform === 'win32') {
        const killCmd = `start "" cmd /c "timeout /t 1 >nul & taskkill /f /fi \"windowtitle eq Rexermi Server Terminal\" & taskkill /f /fi \"windowtitle eq Rexermi Server Manager\""`;
        exec(killCmd, { cwd: process.cwd() });
      }

      setTimeout(() => {
        console.log('Stopping server process as requested...');
        process.exit(0);
      }, 500);

      return NextResponse.json({
        success: true,
        message: 'Apagando el servidor a nivel de software...'
      });
    }

    if (typedAction === 'restart' || typedAction === 'reboot_app') {
      // Software-level restart: Start a new server instance and stop the current one.
      let command = '';

      if (platform === 'win32') {
        command = `start "" cmd /c "timeout /t 1 >nul & taskkill /f /fi \"windowtitle eq Rexermi Server Terminal\" & taskkill /f /fi \"windowtitle eq Rexermi Server Manager\" & timeout /t 1 >nul & start \"Rexermi Server Terminal\" cmd /k \"${runCmd}\""`;
      } else {
        // On Linux/macOS
        command = `sh -c "sleep 2 && (x-terminal-emulator -T \"Rexermi Server Terminal\" -e \"${runCmd}\" || gnome-terminal --title=\"Rexermi Server Terminal\" -- ${runCmd} || xterm -T \"Rexermi Server Terminal\" -e ${runCmd} || ${runCmd})"`;
      }

      exec(command, { cwd: process.cwd() });

      setTimeout(() => {
        console.log('Restarting server process as requested...');
        process.exit(0);
      }, 500);

      return NextResponse.json({
        success: true,
        message: 'Reiniciando el servidor a nivel de software...'
      });
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 });

  } catch (error: any) {
    console.error('Server Control POST Action Error:', error);
    return NextResponse.json({
      error: 'Error interno al procesar la acción del servidor.'
    }, { status: 500 });
  }
}
