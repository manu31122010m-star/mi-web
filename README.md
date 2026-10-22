# Mis apps: Estudio y FOCUS

Dos apps web instalables (PWA), sin dependencias ni compilación. Funcionan sin conexión y guardan los datos solo en el dispositivo.

## 📚 Estudio (`estudio/`)

- **Hoy**: qué toca ahora, tareas del día, próximos exámenes, horas estudiadas y racha.
- **Plan**: horario semanal propio (sin ejemplos) con avisos, copiar días y exportación a calendario `.ics`; y **tareas con fecha**.
- **Asignaturas**: objetivo semanal de horas, exámenes, temas con estado (pendiente → dominado), apuntes y **tarjetas de repaso**.
- **Concentración**: sesiones por bloques con descansos. Pantalla completa, pantalla siempre encendida, aviso inmediato al salir de la app (se cuentan las salidas) y abandono solo manteniendo pulsado. Incluye una guía para activar el **bloqueo real de apps** del sistema (Android: Bienestar digital → Modo Concentración; iPhone: Concentración + Tiempo de uso + Atajos).
- **Asistente sin conexión**: organiza el horario, tareas y exámenes, planifica un examen tema a tema, hace tests con tus tarjetas, busca en tus apuntes y da técnicas de estudio. Abierto desde claude.ai puede usar Claude (opcional, en Ajustes).

> Una web no puede bloquear otras apps del móvil: el bloqueo real lo hace el sistema operativo (ver la guía dentro de la app).

## 🏋️ FOCUS (`focus/`)

- **Gym**: rutinas propias por día y hora, +60 ejercicios con mapa muscular y técnica, material del gimnasio, sesión en vivo con descansos, récords y progreso.
- **Comidas**: +100 alimentos con macros y micronutrientes, Open Food Facts, escáner de código de barras, fotos, objetivos y análisis.
- **Asistente sin conexión**: crea rutinas, apunta comidas a partir de frases, macros, ideas de comidas, progreso y dudas de gym y nutrición.
- Avisos antes de entrenar y a las horas de comida que elijas.

## Uso

```bash
npx http-server . -p 8080
```

Para la cámara y los avisos en el móvil, publícalas por https (p. ej. GitHub Pages) y añádelas a la pantalla de inicio. Los iconos se generan con `python3 tools/make-icons.py` a partir de `*/icons/logo-original.jpg`.
