export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function POST(req: Request) {
  try {
    const { name } = (await req.json()) as any;
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    
    const slug = slugify(name);
    
    // Check if category already exists
    const existing = await dbQuery<any[]>('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'La categoría ya existe' }, { status: 400 });
    }
    
    const result = await dbQuery(
      'INSERT INTO categories (name, slug, icon, is_active, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), slug, 'box', 1, 0]
    );
    
    return NextResponse.json({ 
      success: true, 
      category: { id: result.insertId, name: name.trim(), slug } 
    });
  } catch (err: any) {
    console.error('Error creating category:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
