# Mantenimiento de las apps

Cada día una tarea programada revisa las apps (Estudio, FOCUS, Mi Gym y Foco), corrige fallos y publica una versión nueva si hay cambios. Al abrir la app sale el aviso **«🆕 Nueva versión · Actualizar»** y en Ajustes/Perfil está el botón **«Buscar actualizaciones»**.

## Peticiones pendientes

Escribe aquí lo que quieras cambiar o añadir (una línea por petición). La revisión diaria lo hace y lo tacha.

- (vacío)

## Cómo se publica un cambio

1. Hacer el cambio en la app (`estudio/`, `focus/`, `gym/` o `foco/`).
2. Probar: `node tools/smoke.js` (abre cada pantalla en un móvil simulado, busca errores y comprueba el aviso de actualización).
3. Publicar la versión: `python3 tools/release.py <app|all> "Novedad 1" ["Novedad 2"…]` (`--minor` para cambios grandes).
   Sube el número en `<app>/version.json` y renueva la caché del service worker.
4. Commit y push. En cuanto GitHub Pages publica, la app avisa con el botón «Actualizar».

## Reglas

- No borrar ni renombrar claves de datos guardados (`localStorage`): los datos del usuario deben seguir funcionando.
- Cambios pequeños y probados; nada de quitar funciones sin que se pida.
- Todo en español.
