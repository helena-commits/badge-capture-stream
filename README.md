# Badge Photo Capture App

Uma aplicação para capturar fotos e gerar crachás automaticamente.

## Funcionalidades

- **Captura de Fotos**: Interface simples para tirar fotos usando a câmara do dispositivo
- **Campos Personalizados**: Captura de nome e função junto com a foto
- **Lista de Fotos**: Visualização de todas as fotos capturadas com filtros e pesquisa
- **Geração Automática de Crachás**: Integração com sistema externo para geração de crachás
- **Auto-abertura**: Opção para abrir automaticamente o gerador de crachás ao receber novas fotos
- **Proteção por Senha**: Acesso restrito à lista de fotos

## Tecnologias

- React + TypeScript
- Tailwind CSS
- Supabase (Database + Storage)
- Vite

## Configuração do Banco de Dados

### Migração Necessária

Para usar os novos campos de nome e função, execute a seguinte migração SQL no Supabase:

```sql
-- Add name and role columns to photos table
ALTER TABLE public.photos 
ADD COLUMN name TEXT,
ADD COLUMN role TEXT;
```

### Estrutura da Tabela `photos`

```sql
CREATE TABLE public.photos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed BOOLEAN NOT NULL DEFAULT false,
    file_url TEXT NOT NULL,
    file_path TEXT,
    name TEXT,
    role TEXT
);
```

### Storage Bucket

Certifique-se de que existe um bucket `photos` no Supabase Storage:

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true);
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Senha para acesso à lista (opcional, usa fallback se não definida)
VITE_LIST_PASSWORD=Bern2025#

# URL do gerador de crachás (opcional, usa fallback se não definida)
VITE_BADGES_URL=https://growing-badges.lovable.app
```

## Como Usar

1. **Captura**: Acesse a página inicial, preencha nome e função, tire uma foto e clique em "Guardar"
2. **Lista**: Acesse `/lista` com a senha `Bern2025#` para ver todas as fotos
3. **Geração de Crachás**: Use os botões na lista para abrir o gerador de crachás ou configure a abertura automática

## Rotas

- `/` - Página de captura de fotos
- `/lista` - Lista de fotos (protegida por senha)

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy

A aplicação pode ser facilmente implantada no Lovable ou qualquer plataforma que suporte aplicações Vite.