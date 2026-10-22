# FOCUS

App web (PWA) para planificar el día a día: rutinas, horas de estudio, gym y comidas, con avisos.

## Secciones

- **Hoy** — qué toca ahora y qué viene después, progreso del día, calorías/macros y la línea de tiempo con accesos directos (entrenar, registrar comida, estudiar).
- **Plan** — horario semanal por bloques (estudio, gym, comida, rutina, trabajo, descanso, ocio…), con días, recordatorio, detección de solapes, copiar días y exportación a calendario `.ics` con alarmas.
- **Gym** — creas tus propias rutinas y las asignas a cada día de la semana; +60 ejercicios con mapa muscular (frontal y posterior) e indicaciones de cómo hacerlos; inventario del material de tu gimnasio; sesión en vivo con series/kg/reps, temporizador de descanso, “última vez”, récords, 1RM estimado, volumen y series por grupo.
- **Comidas** — más de 100 alimentos con macros y micronutrientes, búsqueda en Open Food Facts, **escáner de códigos de barras con la cámara**, **foto del plato** (con análisis por IA dentro de claude.ai), alimentos propios, objetivos con calculadora (Mifflin-St Jeor) y análisis completo del día y de la semana.
- **Estudio** — pomodoro por asignatura (25/5, 50/10, 90/15), horas por asignatura y objetivo semanal.
- **Asistente** — chat que funciona **sin internet y sin cuentas**: responde sobre tu plan, macros, progreso y estudio; crea actividades y rutinas, apunta comidas a partir de frases (“he comido 200 g de arroz”), da ideas de comidas y resuelve dudas de gym, nutrición, estudio y hábitos. Si abres FOCUS desde claude.ai, en Ajustes puedes cambiarlo a Claude para respuestas más completas y análisis de fotos.
- **Ajustes** — notificaciones, tema claro/oscuro, copia de seguridad (exportar/importar).

## Uso

No necesita instalación ni compilación: son archivos estáticos.

```bash
npx http-server . -p 8080   # o cualquier servidor estático
```

Para usar la cámara y las notificaciones en el móvil la app debe abrirse por **https** (por ejemplo con GitHub Pages: *Settings → Pages → Deploy from branch*). Después, en el navegador del móvil: **“Añadir a pantalla de inicio”** para instalarla como app.

Los datos se guardan solo en el dispositivo (localStorage). Usa *Ajustes → Exportar copia* para guardarlos.
