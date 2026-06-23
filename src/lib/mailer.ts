import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '2525', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'noreply@rexermi.uk';

// Create a transporter pool if SMTP credentials are provided
const createTransporter = () => {
  if (!smtpHost || !smtpUser) {
    // If not configured, we'll log to console and return a mock/silent transporter
    return {
      sendMail: async (mailOptions: any) => {
        console.log('--- SMTP Not Configured ---');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Body:', mailOptions.text);
        return { messageId: 'mock-id' };
      }
    };
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendOrderEmail(to: string, orderData: {
  orderNumber: string;
  customerName: string;
  items: Array<{ name: string; price: number; quantity: number; subtotal: number }>;
  total: number;
  paymentMethod: string;
  shippingAddress: string;
}) {
  const transporter = createTransporter();

  const customerNameEscaped = escapeHtml(orderData.customerName);
  const shippingAddressEscaped = escapeHtml(orderData.shippingAddress || '');
  const orderNumberEscaped = escapeHtml(orderData.orderNumber);
  const paymentMethodEscaped = escapeHtml(orderData.paymentMethod);

  const itemsHtml = orderData.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">${escapeHtml(item.name)} x ${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Pedido Confirmado - Rexermi</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 20px; color: #333;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr style="background-color: #0A0A0F; text-align: center;">
          <td style="padding: 30px 20px;">
            <h1 style="color: #D4AF37; margin: 0; font-size: 28px; letter-spacing: 2px; font-weight: bold;">REXERMI</h1>
            <p style="color: #9090A8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase;">Tu tienda de confianza</p>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="margin-top: 0; color: #111;">¡Hola, ${customerNameEscaped}!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #555;">
              Tu pedido ha sido recibido con éxito. A continuación, encontrarás los detalles de tu compra:
            </p>
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
              <p style="margin: 0; font-size: 15px;"><strong>Número de Pedido:</strong> <span style="font-family: monospace; font-size: 16px; color: #A88C1E;">${orderNumberEscaped}</span></p>
              <p style="margin: 5px 0 0 0; font-size: 15px;"><strong>Método de Pago:</strong> ${paymentMethodEscaped}</p>
            </div>
            
            <h3 style="margin-top: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; color: #111;">Resumen del Pedido</h3>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; font-size: 15px;">
              <thead>
                <tr style="background-color: #f2f2f2; font-weight: bold;">
                  <th style="padding: 10px; text-align: left;">Producto</th>
                  <th style="padding: 10px; text-align: right; width: 80px;">Precio</th>
                  <th style="padding: 10px; text-align: right; width: 100px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 15px 10px 10px; font-weight: bold; text-align: right;">Total:</td>
                  <td style="padding: 15px 10px 10px; font-weight: bold; text-align: right; color: #A88C1E; font-size: 18px;">$${Number(orderData.total).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <h3 style="margin-top: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; color: #111;">Dirección de Envío</h3>
            <p style="font-size: 15px; line-height: 1.5; color: #555; background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin-top: 10px;">
              ${shippingAddressEscaped.replace(/\n/g, '<br>')}
            </p>
            
            <p style="font-size: 15px; line-height: 1.5; color: #555; margin-top: 30px;">
              Si has seleccionado un método de pago manual (como Pago Móvil o Transferencia), procesaremos tu pedido tan pronto como validemos tu comprobante.
            </p>
            <p style="font-size: 15px; line-height: 1.5; color: #555;">
              ¡Gracias por confiar en Rexermi!
            </p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr style="background-color: #f2f2f2; text-align: center; font-size: 12px; color: #777;">
          <td style="padding: 20px;">
            <p style="margin: 0;">Este es un correo automático, por favor no respondas directamente a este mensaje.</p>
            <p style="margin: 5px 0 0 0;">&copy; 2026 Rexermi Marketplace. Todos los derechos reservados.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Rexermi Marketplace" <${smtpFrom}>`,
      to,
      subject: `Confirmación de Pedido - ${orderNumberEscaped}`,
      text: `¡Hola, ${customerNameEscaped}! Tu pedido ${orderNumberEscaped} ha sido recibido. Total: $${Number(orderData.total).toFixed(2)}.`,
      html: htmlContent,
    });
  } catch (error) {
    console.error('Error enviando el correo de confirmación:', error);
  }
}

// Alias used by the checkout API route
export async function sendOrderConfirmationEmail(opts: {
  to: string;
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  paymentMethod: string;
}) {
  return sendOrderEmail(opts.to, {
    orderNumber: opts.orderNumber,
    customerName: opts.customerName,
    items: opts.items.map(i => ({ ...i, subtotal: i.price * i.quantity })),
    total: opts.total,
    paymentMethod: opts.paymentMethod,
    shippingAddress: '',
  });
}

export async function sendOrderStatusEmail(to: string, orderData: {
  orderNumber: string;
  customerName: string;
  status: string;
}) {
  const transporter = createTransporter();

  const customerNameEscaped = escapeHtml(orderData.customerName);
  const orderNumberEscaped = escapeHtml(orderData.orderNumber);
  
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'En Procesamiento',
    shipped: 'Enviado / Listo para Retirar',
    delivered: 'Entregado / Finalizado',
    cancelled: 'Cancelado'
  };

  const statusLabel = statusLabels[orderData.status] || orderData.status;
  
  let statusDetailMessage = '';
  if (orderData.status === 'processing') {
    statusDetailMessage = 'Estamos preparando los productos de tu pedido.';
  } else if (orderData.status === 'shipped') {
    statusDetailMessage = 'Tu pedido ha sido enviado a la dirección indicada o está listo para ser retirado en la tienda.';
  } else if (orderData.status === 'delivered') {
    statusDetailMessage = 'Tu pedido ha sido entregado correctamente. ¡Muchas gracias por tu compra!';
  } else if (orderData.status === 'cancelled') {
    statusDetailMessage = 'Tu pedido ha sido cancelado. Si crees que esto es un error, por favor ponte en contacto con soporte.';
  } else {
    statusDetailMessage = 'Tu pedido ha cambiado de estado.';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Actualización de Pedido - Rexermi</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 20px; color: #333;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr style="background-color: #0A0A0F; text-align: center;">
          <td style="padding: 30px 20px;">
            <h1 style="color: #D4AF37; margin: 0; font-size: 28px; letter-spacing: 2px; font-weight: bold;">REXERMI</h1>
            <p style="color: #9090A8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase;">Tu tienda de confianza</p>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="margin-top: 0; color: #111;">¡Hola, ${customerNameEscaped}!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #555;">
              Queremos informarte que el estado de tu pedido ha sido actualizado:
            </p>
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #D4AF37; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
              <p style="margin: 0; font-size: 15px;"><strong>Número de Pedido:</strong> <span style="font-family: monospace; font-size: 16px; color: #A88C1E;">${orderNumberEscaped}</span></p>
              <p style="margin: 5px 0 0 0; font-size: 15px;"><strong>Nuevo Estado:</strong> <span style="font-weight: bold; color: #A88C1E;">${statusLabel}</span></p>
            </div>
            
            <p style="font-size: 15px; line-height: 1.5; color: #555;">
              ${statusDetailMessage}
            </p>
            
            <p style="font-size: 15px; line-height: 1.5; color: #555; margin-top: 30px;">
              ¡Gracias por confiar en Rexermi!
            </p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr style="background-color: #f2f2f2; text-align: center; font-size: 12px; color: #777;">
          <td style="padding: 20px;">
            <p style="margin: 0;">Este es un correo automático, por favor no respondas directamente a este mensaje.</p>
            <p style="margin: 5px 0 0 0;">&copy; 2026 Rexermi Marketplace. Todos los derechos reservados.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Rexermi Marketplace" <${smtpFrom}>`,
      to,
      subject: `Actualización de Pedido - ${orderNumberEscaped}`,
      text: `¡Hola, ${customerNameEscaped}! El estado de tu pedido ${orderNumberEscaped} ahora es: ${statusLabel}.`,
      html: htmlContent,
    });
  } catch (error) {
    console.error('Error enviando el correo de estado de pedido:', error);
  }
}

