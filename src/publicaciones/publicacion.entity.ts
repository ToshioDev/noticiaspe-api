export interface Publicacion {
  id: number;
  title_path: string;
  titulo: string;
  contenido: string;
  imagen_url?: string;
  resumen?: string;
  boton_texto?: string;
  fecha_publicacion: Date;
  autor_id: number;
  autor?: any; 
  estado: 'PUBLICADO' | 'BORRADOR' | 'ARCHIVADO';
  external: boolean;
  categorias: any[]; 
  etiquetas: any[];  
  external_data?: string;
}
