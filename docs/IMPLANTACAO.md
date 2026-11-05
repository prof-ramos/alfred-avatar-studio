# Implantação e operação

## Acesso e dados

Produção: <https://alfred.proframos.com>, implantada em **05/11/2026**, com acesso público sem autenticação.

O estúdio é uma aplicação estática executada no navegador. Projetos e preferências ficam no IndexedDB de cada navegador e origem; a VPS não guarda os projetos dos visitantes. Não há backend compartilhado nem sincronização entre dispositivos. Para backup e transferência, use **Projetos → Exportar JSON** e a importação de projetos. Dados criados em `localhost` não aparecem automaticamente no domínio de produção.

## Versão publicada

| Item | Registro da implantação inicial |
|---|---|
| Código | [`f48ae9f20acdc4f95afcaf2a4199e0aa8e61b4e1`](https://github.com/prof-ramos/alfred-avatar-studio/commit/f48ae9f20acdc4f95afcaf2a4199e0aa8e61b4e1) |
| Pacote na VPS | `releases/f48ae9f/dist.tar.gz` |
| SHA-256 do pacote | `b346628746ada59cff116c51aca935f589d6172e5015c52026f45e7bc676a1cc` |
| Diretório ativo | `current` → `releases/f48ae9f/dist` |
| Imagem do servidor | nginx oficial ARM64, fixado em `sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949` |

Os caminhos relativos desta página partem de `/home/ubuntu/alfred-service`, na VPS acessível pelo alias SSH administrativo `oci-proframos`. `compose.yaml` e o `README.md` desse diretório são as referências da configuração efetiva. Uma atualização de documentação no GitHub não publica uma nova versão do aplicativo.

## Arquitetura

```text
Navegador → Cloudflare (proxy DNS/TLS) → Traefik existente → nginx → dist estático
    └── IndexedDB local: projetos e preferências
```

- Registro DNS A do subdomínio com proxy Cloudflare ativo; TLS da zona em **Full (strict)**.
- Traefik utiliza a rede Docker `proxy` e o resolvedor ACME existente `letsencryptresolver`, com certificado Let's Encrypt para a origem e renovação pelo próprio Traefik.
- Serviço Compose `studio`, contêiner `alfred-studio`. Nenhuma porta adicional é publicada no host; o tráfego passa pelo Traefik existente.
- nginx executa como usuário 101, com filesystem e conteúdo estático somente para leitura, capabilities removidas, tmpfs de 16 MiB e limites de 64 MiB/0,25 CPU. Política de reinício `unless-stopped` e healthcheck HTTP local.
- Não há Node.js ou servidor de desenvolvimento na VPS, nem volume de dados do aplicativo. Serviços preexistentes foram preservados.
- HTML exige revalidação; assets com hash têm cache. Páginas usam fallback para `index.html`; assets inexistentes retornam 404. A interface atual usa `/` e painéis internos.

## Build e publicação

O build é feito fora da VPS, usando a versão de Node.js exigida pelo projeto e o lockfile versionado:

```bash
npm ci
npm test
npm run build
```

A saída publicável é `dist/`. Para cada atualização autorizada:

1. Registre o commit, execute as verificações pertinentes e empacote `dist/`, registrando o SHA-256 do pacote.
2. Transfira o pacote para uma nova pasta `releases/<commit>/` e extraia em `releases/<commit>/dist`, preservando a versão anterior. Não copie dependências, `.env` ou arquivos de sessão.
3. Guarde a configuração anterior em `backups/` e registre o destino anterior de `current`. Confira permissões de leitura para o usuário do nginx.
4. Atualize `current` para a nova pasta e recrie **somente** `studio`, a partir do diretório do serviço:

   ```bash
   sudo docker compose config --quiet
   sudo docker compose up -d --force-recreate --no-deps studio
   sudo docker compose ps
   ```

5. Confira healthcheck, HTTPS, assets, abertura da interface e persistência de um projeto de teste; registre commit e resultados no README operacional da VPS e nesta página.

O bind mount resolve o destino do link ao criar o contêiner. Alterar apenas `current` não troca o conteúdo montado no contêiner em execução. A publicação é manual; não há integração contínua de implantação configurada por esta entrega.

## Operação e manutenção

```bash
ssh oci-proframos
cd /home/ubuntu/alfred-service
sudo docker compose ps
sudo docker compose logs --tail 50 studio
sudo docker compose up -d studio
```

Confira a saúde do contêiner, o espaço ocupado por releases/backups, a validade do certificado de origem e os resultados HTTP após alterações. Preserve o digest da imagem até uma atualização deliberada e verificada. As configurações do Traefik e da zona Cloudflare são compartilhadas com outros serviços e devem ser mantidas ao operar apenas o Alfred.

Backups de configuração e artefatos na VPS não substituem o backup dos projetos: cada usuário exporta seus dados pelo navegador. A implantação inicial mantém `backups/config-initial-20261105.tar.gz` e o pacote da release em `releases/f48ae9f/dist.tar.gz`.

## Reversão e retirada do ar

Para reverter uma atualização, restaure o destino anterior de `current` e recrie somente `studio` com o comando de publicação acima. A release inicial disponível para retorno é `releases/f48ae9f/dist`. Se a configuração também mudou, restaure sua cópia correspondente antes de validar o Compose e recriar o serviço.

Para parar o Alfred de forma reversível:

```bash
cd /home/ubuntu/alfred-service
sudo docker compose down
```

Para retomá-lo, execute `sudo docker compose up -d studio`. A primeira implantação não substituiu uma aplicação Alfred anterior. Se a retirada for definitiva, remova apenas o registro DNS do subdomínio Alfred, após confirmar seu destino; preserve redes, Traefik, SSL da zona e os demais registros. Os dados dos visitantes continuam em seus navegadores.

## Evidências e limites

Registro da implantação de 05/11/2026, conservado no README operacional da VPS:

- `npm ci`, build TypeScript/Vite e **84 testes Vitest em 9 arquivos** concluídos; auditoria das dependências sem vulnerabilidades naquele momento.
- Configuração Compose e `nginx -t` aprovados; contêiner saudável. HTTPS público e origem direta com validação de certificado retornaram 200; o teste HTTP inicial registrou 308 para HTTPS.
- CSS/JS públicos conferidos contra o artefato local; fallback de página serviu `index.html` e `/assets/missing.js` retornou 404. Ponte de testes ausente na produção.
- Verificação em navegador: interface e Canvas 240 × 240, criação e renomeação de projeto, modo Display persistido após recarga, simulação no estado Pensando e exportação de JSON válido.

Na conferência para esta documentação, em 05/11/2026, o contêiner continuava saudável, HTTPS público retornou **200** e HTTP público retornou **301** para HTTPS. O código do redirecionamento público pode diferir daquele observado diretamente na origem ou na verificação inicial.

A suíte Playwright completa e o hardware físico **não foram testados nesta implantação**. A verificação em navegador cobre os fluxos citados, sem substituir a suíte completa, a conferência de todas as exportações ou a validação em bancada. Consulte o [plano E2E](./PLANO_E2E.md) e o [PR #3 de validação do simulador](https://github.com/prof-ramos/alfred-avatar-studio/pull/3), que registra testes de caracterização e inconsistências ainda em avaliação. O código desse PR não integra o artefato inicial publicado.
