# Arquitetura de Deploy CI/CD - Frontend Angular

## Visão geral

Este documento descreve a arquitetura de deploy do frontend Angular, explicando como um desenvolvedor pode entender, executar e manter o processo de publicação da aplicação.

A solução utiliza:

* GitHub Actions para integração e entrega contínua (CI/CD).
* SSH para comunicação segura entre GitHub Actions e a VM.
* Nginx para servir os arquivos estáticos do Angular.
* Um script de release no servidor para controlar versões e facilitar rollback.

A aplicação não executa Angular diretamente no servidor. O Angular é compilado em arquivos estáticos (`HTML`, `CSS`, `JavaScript`) e o Nginx apenas entrega esses arquivos aos usuários.

# Arquitetura geral

```text
Desenvolvedor
      |
      | git push
      v
GitHub Repository
      |
      v
GitHub Actions
      |
      | npm install
      | ng build
      | criar arquivo .tar.gz
      |
      | SSH/SCP
      v
Servidor Linux (VM)
      |
      |
      +-----------------------+
      |                       |
      v                       v
/opt/frontend/uploads    release.sh
                              |
                              v
                    /opt/frontend/releases
                              |
                              v
                    /opt/frontend/current
                              |
                              v
                           Nginx
                              |
                              v
                           Usuário
```

# Componentes

## GitHub Actions

O GitHub Actions é responsável por:

1. Baixar o código do repositório.
2. Instalar dependências.
3. Executar o build de produção do Angular.
4. Compactar os arquivos gerados.
5. Enviar o pacote para o servidor.
6. Executar o script de publicação.

O workflow fica localizado em:

```
.github/workflows/deploy.yml
```

# Build Angular

Durante o pipeline:

```bash
npm ci

npm run build -- --configuration production
```

O Angular gera os arquivos finais:

Exemplo:

```
dist/
└── nepa-frontend/
    └── browser/
        ├── index.html
        ├── main-HDSPDKCB.js
        ├── chunk-XXXX.js
        ├── styles-XXXX.css
        └── assets/
```

Os nomes dos arquivos JavaScript possuem hashes:

```
main-HDSPDKCB.js
chunk-XUJYJ4PV.js
```

Isso permite cache eficiente, pois uma alteração no código gera novos nomes de arquivos.

# Empacotamento

O workflow cria um arquivo:

```
frontend.tar.gz
```

contendo somente o conteúdo servido pelo Nginx:

```
index.html
main.js
chunks.js
styles.css
assets/
```

O arquivo é enviado para:

```
/opt/frontend/uploads/frontend.tar.gz
```

# Usuário de deploy

O servidor possui um usuário dedicado para automação:

```
deploy
```

Esse usuário é utilizado apenas pelo GitHub Actions.

Ele possui:

* chave SSH própria;
* permissão para executar o script de release;
* nenhuma permissão administrativa direta.

A autenticação utiliza:

```
GitHub Actions
        |
        |
        v
SSH Key
        |
        |
        v
/home/deploy/.ssh/authorized_keys
```

As credenciais nunca devem ser armazenadas no repositório.

# Estrutura no servidor

A estrutura utilizada é:

```
/opt/frontend

├── uploads/
│   └── frontend.tar.gz
│
├── releases/
│   ├── 20261005-204054/
│   ├── 20261006-103000/
│   └── ...
│
├── current -> releases/20261006-103000
│
└── scripts/
    └── release.sh
```

# Diretório uploads

Local temporário onde o GitHub Actions envia o pacote.

Exemplo:

```
/opt/frontend/uploads/frontend.tar.gz
```

Esse arquivo é consumido pelo script de release.

# Diretório releases

Cada deploy cria uma nova versão.

Exemplo:

```
releases/

20261005-204054
20261006-103000
20261007-091500
```

Cada diretório contém uma versão completa do frontend.

Isso permite rollback.

# Symlink current

O Nginx não aponta diretamente para uma release.

Ele aponta para:

```
/opt/frontend/current
```

Esse caminho é um link simbólico:

```
current
   |
   v
releases/20261007-091500
```

Quando uma nova versão é publicada, apenas o link muda.

Vantagens:

* troca instantânea;
* sem arquivos parcialmente copiados;
* rollback simples.

# Script de release

Arquivo:

```
/opt/frontend/scripts/release.sh
```

Responsabilidades:

1. Verificar se o pacote existe.
2. Validar o arquivo `.tar.gz`.
3. Criar uma nova release.
4. Extrair os arquivos.
5. Validar se existe `index.html`.
6. Ajustar permissões.
7. Atualizar o link `current`.
8. Remover releases antigas.

Fluxo:

```
frontend.tar.gz

      |
      v

Nova release

      |
      v

Validação

      |
      v

Atualização do symlink

      |
      v

Deploy concluído
```

# Nginx

O Nginx serve arquivos estáticos.

Configuração simplificada:

```nginx
server {
    listen 8891;

    root /opt/frontend/current;

    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

# Angular Routing

Como Angular utiliza rotas no frontend:

Exemplo:

```
/login
/dashboard
/profile
```

Essas rotas não existem como arquivos físicos.

Por isso existe:

```nginx
try_files $uri $uri/ /index.html;
```

Exemplo:

```
GET /login

arquivo /login existe?
        |
        não

retorna index.html
        |
Angular Router assume a rota
```

# Cache do navegador

Arquivos Angular possuem hash:

```
main-HDSPDKCB.js
chunk-XUJYJ4PV.js
```

Eles podem ser cacheados por muito tempo.

Porém:

```
index.html
```

não deve possuir cache agressivo.

Motivo:

```
index.html
       |
       aponta para
       |
       v
chunk-XXXX.js
```

Se o navegador guardar uma versão antiga do `index.html`, ele pode tentar carregar chunks que não existem mais.

Configuração recomendada:

```nginx
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location ~* \.(js|css|png|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

# Rollback

Caso uma versão apresente problemas:

Listar releases:

```bash
ls /opt/frontend/releases
```

Exemplo:

```
20261005-204054
20261006-103000
```

Voltar:

```bash
sudo ln -sfn \
/opt/frontend/releases/20261005-204054 \
/opt/frontend/current
```

Não é necessário reiniciar o Nginx.

A mudança é imediata.

# Variáveis do GitHub Actions

As seguintes informações devem existir como Repository Secrets:

```
SSH_HOST
SSH_PORT
SSH_USER
SSH_PRIVATE_KEY
```

Nunca adicionar:

* senhas;
* chaves privadas;
* tokens;
* credenciais;

diretamente no código.

# Processo completo de deploy

Quando um desenvolvedor executa:

```bash
git push origin main
```

acontece:

```
Push
 |
 v
GitHub Actions
 |
 +-- npm ci
 |
 +-- Angular build
 |
 +-- criar pacote
 |
 +-- SSH para servidor
 |
 +-- enviar frontend.tar.gz
 |
 +-- executar release.sh
 |
 v
Nova release ativa
 |
 v
Nginx entrega nova versão
```

# Troubleshooting

## Verificar release atual

```bash
readlink -f /opt/frontend/current
```

## Ver arquivos publicados

```bash
ls -lahL /opt/frontend/current
```

## Ver logs do Nginx

```bash
sudo tail -f /var/log/nginx/access.log
```

```bash
sudo tail -f /var/log/nginx/error.log
```

## Validar configuração Nginx

```bash
sudo nginx -t
```

## Recarregar Nginx

```bash
sudo systemctl reload nginx
```

# Boas práticas

* Nunca editar arquivos diretamente dentro de `/opt/frontend/current`.
* Sempre publicar através do pipeline.
* Nunca armazenar credenciais no repositório.
* Manter algumas releases antigas para rollback.
* Alterar a configuração do servidor somente via documentação.
* Testar manualmente o deploy antes de alterar o workflow.
