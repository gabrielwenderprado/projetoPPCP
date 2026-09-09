# Publicação e instalação do PWA

O projeto agora pode ser instalado como aplicativo em celulares, tablets e computadores. Ele contém `manifest.webmanifest`, `service-worker.js` e os ícones em `icons/`.

## Publicação

Publique a pasta em um endereço HTTPS, como GitHub Pages. Depois de enviar as alterações ao GitHub, ative **Settings → Pages → Deploy from a branch → main → root**.

## Instalação

No Android, abra o endereço no Chrome e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**. No computador, abra no Chrome ou Edge e clique no ícone de instalação na barra de endereço. No iPhone, abra no Safari, toque em Compartilhar e escolha **Adicionar à Tela de Início**.

O Service Worker usa uma estratégia de rede primeiro e mantém os arquivos locais em cache como fallback. Para publicar uma nova versão dos arquivos, o `CACHE_NAME` em `service-worker.js` deve ser incrementado, por exemplo, de `dashboard-estoque-v3` para `dashboard-estoque-v4`.

A atualização dos dados continua sendo feita no computador com `atualizar-dados.bat`, `atualizar-dados.sh` ou `python scripts/atualizar_todos_dados.py`. Depois, envie a pasta `data/` ao GitHub e abra o aplicativo novamente para receber os novos snapshots.
