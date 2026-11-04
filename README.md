# Sprint Challenge

Jogo multiplayer para retrospectivas de sprint. Não usa Firebase.

## Publicação no Render

1. Envie `server.js`, `package.json`, `render.yaml` e a pasta `public` para a raiz de um repositório GitHub.
2. No Render, crie um Web Service conectado ao repositório (ou use Blueprint com `render.yaml`).
3. Build Command: `npm install`; Start Command: `npm start`.
4. Abra o endereço HTTPS do Render, crie a sala e compartilhe o link + PIN.

## Rodar localmente

```bash
npm install
npm start
```

Abra http://localhost:3000

## Limitações

- As salas e respostas ficam apenas na memória do servidor e desaparecem após reinício ou suspensão.
- O modelo de perguntas salvo fica apenas no navegador do facilitador.
- Um PIN de seis dígitos não é uma proteção adequada para informações confidenciais.
- Para testar o multiplayer no mesmo navegador, use janela anônima ou outro perfil; duas abas do mesmo perfil compartilham identidade.
- O facilitador deve exportar os resultados antes de sair. O Render gratuito pode suspender o serviço.
