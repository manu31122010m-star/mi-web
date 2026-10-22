/* Datos base: ejercicios, material y alimentos (valores por 100 g) */
'use strict';
window.APPDATA = {
  CATS: {
    estudio: { label: 'Estudio', color: '#8b6cff', icon: '📚' },
    gym: { label: 'Gym', color: '#ff5c7a', icon: '🏋️' },
    comida: { label: 'Comida', color: '#ffb547', icon: '🍽️' },
    rutina: { label: 'Rutina', color: '#2fd18b', icon: '✨' },
    trabajo: { label: 'Trabajo', color: '#8aa0c8', icon: '💼' },
    descanso: { label: 'Descanso', color: '#4cc3ff', icon: '😴' },
    ocio: { label: 'Ocio', color: '#f472b6', icon: '🎮' },
    otro: { label: 'Otro', color: '#c4b5fd', icon: '📌' }
  },

  MEALS: [
    ['desayuno', 'Desayuno', '☕'],
    ['mediamanana', 'Media mañana', '🍎'],
    ['comida', 'Comida', '🍲'],
    ['merienda', 'Merienda', '🥪'],
    ['cena', 'Cena', '🌙'],
    ['snack', 'Snacks', '🍫']
  ],

  // Músculos del mapa corporal:
  // chest, delts, rear, traps, lats, upperback, lowerback, biceps, triceps, forearms,
  // abs, obliques, quads, hamstrings, glutes, adductors, abductors, calves
  // [grupo, [[nombre, equipo, tipo, principales, secundarios, cómo hacerlo]]]
  EXERCISES: [
    ['Pecho', [
      ['Press de pecho sentado', 'Máquina', '', ['chest'], ['delts', 'triceps'], 'Espalda bien apoyada. Empuja hacia delante sin bloquear los codos y baja controlando hasta notar el estiramiento del pecho.'],
      ['Press de pecho inclinado', 'Máquina', '', ['chest'], ['delts', 'triceps'], 'Ajusta el asiento para que las asas queden a la altura del pecho alto. Empuja arriba y adelante y baja lento.'],
      ['Contractora / Pec Deck', 'Máquina', '', ['chest'], ['delts'], 'Codos ligeramente flexionados. Junta los brazos delante del pecho, aprieta 1 segundo y abre controlando.'],
      ['Máquina de aperturas', 'Máquina', '', ['chest'], ['delts'], 'Abre en un arco amplio hasta sentir el estiramiento y cierra sin chocar las asas.'],
      ['Cruce de poleas', 'Polea', '', ['chest'], ['delts'], 'Da un paso al frente con el torso algo inclinado. Lleva las manos hacia abajo y al centro dibujando un arco.'],
      ['Press de pecho convergente', 'Máquina', '', ['chest'], ['delts', 'triceps'], 'Las asas se juntan al empujar: aprieta el pecho al final del recorrido y baja en 2–3 segundos.']
    ]],
    ['Espalda', [
      ['Jalón al pecho', 'Polea', '', ['lats'], ['biceps', 'upperback', 'rear'], 'Pecho arriba. Tira de la barra hasta la clavícula llevando los codos hacia abajo y atrás; sube sin soltar la tensión.'],
      ['Jalón con agarre estrecho', 'Polea', '', ['lats'], ['biceps', 'upperback'], 'Agarre neutro. Tira hacia la parte baja del pecho con los codos pegados al cuerpo.'],
      ['Remo sentado en polea', 'Polea', '', ['upperback', 'lats'], ['biceps', 'rear'], 'Espalda neutra. Lleva el agarre al abdomen juntando las escápulas, sin balancear el torso.'],
      ['Remo con pecho apoyado', 'Máquina', '', ['upperback', 'lats'], ['rear', 'biceps'], 'Pecho en el apoyo. Tira con los codos hacia atrás y aprieta las escápulas 1 segundo.'],
      ['Remo unilateral en máquina', 'Máquina', '', ['lats', 'upperback'], ['biceps'], 'Un brazo cada vez. Tira hacia la cadera sin girar el tronco.'],
      ['Pullover en máquina', 'Máquina', '', ['lats'], ['chest', 'triceps'], 'Brazos casi estirados. Baja la barra en arco hacia las piernas sintiendo el dorsal.'],
      ['Máquina de dominadas asistidas', 'Máquina', '', ['lats'], ['biceps', 'upperback'], 'Más contrapeso = más ayuda. Sube hasta pasar la barbilla de la barra y baja controlado.'],
      ['Extensiones lumbares', 'Banco', '', ['lowerback'], ['glutes', 'hamstrings'], 'Flexiona desde la cadera con la espalda neutra y sube hasta alinear el cuerpo, sin arquearte de más.']
    ]],
    ['Hombros', [
      ['Press de hombros', 'Máquina', '', ['delts'], ['triceps', 'traps'], 'Espalda apoyada. Empuja por encima de la cabeza sin arquear la zona lumbar y baja hasta la altura de las orejas.'],
      ['Elevaciones laterales en máquina', 'Máquina', '', ['delts'], ['traps'], 'Sube los codos hacia los lados hasta la altura del hombro, sin encoger el cuello.'],
      ['Pájaros / deltoide posterior', 'Máquina', '', ['rear'], ['upperback', 'traps'], 'Brazos casi rectos. Abre hacia atrás en arco y aprieta la parte posterior del hombro.'],
      ['Polea para elevaciones laterales', 'Polea', '', ['delts'], [], 'Polea baja con el cable por delante del cuerpo. Eleva hacia el lado hasta el hombro y baja lento.'],
      ['Encogimientos para trapecio', 'Máquina', '', ['traps'], ['forearms'], 'Sube los hombros hacia las orejas, pausa 1 segundo arriba y baja del todo.']
    ]],
    ['Bíceps y antebrazos', [
      ['Curl de bíceps en máquina', 'Máquina', '', ['biceps'], ['forearms'], 'Brazos apoyados. Flexiona hasta arriba sin despegar los codos y baja hasta estirar.'],
      ['Banco Scott para bíceps', 'Banco', '', ['biceps'], ['forearms'], 'Axilas pegadas al banco. Baja casi hasta estirar y sube sin rebotar.'],
      ['Polea baja para curl', 'Polea', '', ['biceps'], ['forearms'], 'Codos fijos a los lados. Sube la barra hasta el pecho y controla la bajada.'],
      ['Máquina de antebrazos', 'Máquina', '', ['forearms'], [], 'Mueve solo la muñeca: flexiona y extiende con el recorrido completo.']
    ]],
    ['Tríceps', [
      ['Extensión de tríceps en polea', 'Polea', '', ['triceps'], [], 'Codos pegados al cuerpo. Extiende hasta abajo y vuelve hasta 90°.'],
      ['Máquina de fondos asistidos', 'Máquina', '', ['triceps'], ['chest', 'delts'], 'Torso erguido para centrarte en el tríceps. Baja hasta 90° de codo y empuja.'],
      ['Extensión de tríceps sentado', 'Máquina', '', ['triceps'], [], 'Codos fijos. Extiende por completo y aprieta el tríceps al final.'],
      ['Polea alta con cuerda', 'Polea', '', ['triceps'], [], 'Abre la cuerda hacia los lados al final del movimiento y mantén los codos quietos.']
    ]],
    ['Cuádriceps y piernas', [
      ['Prensa de piernas', 'Máquina', '', ['quads'], ['glutes', 'hamstrings'], 'Pies a la anchura de los hombros. Baja hasta 90° sin despegar la zona lumbar del respaldo.'],
      ['Extensión de cuádriceps', 'Máquina', '', ['quads'], [], 'Extiende hasta casi bloquear la rodilla, pausa 1 segundo y baja lento.'],
      ['Sentadilla Hack', 'Máquina', '', ['quads'], ['glutes'], 'Espalda pegada al respaldo. Baja profundo con las rodillas en la dirección de las puntas de los pies.'],
      ['Sentadilla en Smith / multipower', 'Smith', '', ['quads'], ['glutes', 'hamstrings', 'lowerback'], 'Pies algo adelantados. Baja con el pecho alto y empuja con todo el pie.'],
      ['Sentadilla en máquina', 'Máquina', '', ['quads'], ['glutes'], 'Baja controlado hasta que los muslos queden paralelos al suelo y sube empujando con los talones.'],
      ['Extensión unilateral de piernas', 'Máquina', '', ['quads'], [], 'Una pierna cada vez para corregir desequilibrios. Pausa arriba.']
    ]],
    ['Isquiotibiales', [
      ['Curl femoral sentado', 'Máquina', '', ['hamstrings'], ['calves'], 'Ajusta el rodillo sobre los tobillos. Flexiona las rodillas y controla la vuelta.'],
      ['Curl femoral tumbado', 'Máquina', '', ['hamstrings'], ['calves', 'glutes'], 'Cadera pegada al banco. Lleva los talones hacia los glúteos.'],
      ['Curl femoral de pie', 'Máquina', '', ['hamstrings'], ['calves'], 'Una pierna cada vez, sin mover la cadera.'],
      ['Peso muerto en Smith', 'Smith', '', ['hamstrings', 'glutes'], ['lowerback', 'upperback', 'forearms'], 'Barra pegada a las piernas. Flexiona desde la cadera con la espalda recta y sube apretando los glúteos.']
    ]],
    ['Glúteos y abductores', [
      ['Máquina de abductores', 'Máquina', '', ['abductors'], ['glutes'], 'Abre las piernas contra la resistencia, pausa fuera y vuelve lento.'],
      ['Máquina de aductores', 'Máquina', '', ['adductors'], [], 'Cierra las piernas controlando, sin rebotar al abrir.'],
      ['Patada de glúteo en máquina', 'Máquina', '', ['glutes'], ['hamstrings'], 'Empuja hacia atrás con el talón sin arquear la espalda.'],
      ['Polea para patada de glúteo', 'Polea', '', ['glutes'], ['hamstrings'], 'Tobillera en la polea baja. Lleva la pierna hacia atrás y aprieta el glúteo.'],
      ['Máquina de hip thrust', 'Máquina', '', ['glutes'], ['hamstrings'], 'Barbilla al pecho. Sube la cadera hasta alinearla con el torso y aprieta 1 segundo.'],
      ['Prensa con énfasis en glúteos', 'Máquina', '', ['glutes'], ['quads', 'hamstrings'], 'Pies altos y abiertos en la plataforma. Baja profundo y empuja con los talones.']
    ]],
    ['Gemelos', [
      ['Elevación de gemelos sentado', 'Máquina', '', ['calves'], [], 'Baja el talón al máximo y sube de puntillas con una pausa arriba.'],
      ['Elevación de gemelos de pie', 'Máquina', '', ['calves'], [], 'Rodillas casi rectas y recorrido completo.'],
      ['Gemelos en prensa', 'Máquina', '', ['calves'], [], 'Solo las puntas de los pies en la plataforma. Empuja con los dedos.']
    ]],
    ['Abdominales y core', [
      ['Máquina de abdominales', 'Máquina', '', ['abs'], ['obliques'], 'Lleva el pecho hacia la pelvis encogiendo el tronco; no tires con los brazos.'],
      ['Máquina de rotación de tronco', 'Máquina', '', ['obliques'], ['abs'], 'Gira desde el tronco con la cadera fija y sin coger impulso.'],
      ['Banco de abdominales', 'Banco', '', ['abs'], ['obliques'], 'Sube enrollando la columna y baja controlado.'],
      ['Silla romana / elevación de piernas', 'Máquina', '', ['abs'], ['obliques'], 'Espalda apoyada. Sube las rodillas al pecho sin balancearte.'],
      ['Polea para crunch abdominal', 'Polea', '', ['abs'], ['obliques'], 'De rodillas, con la cuerda junto a la cabeza. Flexiona el tronco hacia abajo.']
    ]],
    ['Cardio', [
      ['Cinta de correr', 'Cardio', 'cardio', ['quads', 'hamstrings', 'calves'], ['glutes'], 'Calienta 5 minutos. Sube la inclinación para más intensidad con menos impacto.'],
      ['Bicicleta estática', 'Cardio', 'cardio', ['quads'], ['hamstrings', 'calves', 'glutes'], 'Sillín a la altura de la cadera: la rodilla casi estirada en el punto más bajo.'],
      ['Bicicleta reclinada', 'Cardio', 'cardio', ['quads'], ['glutes', 'hamstrings'], 'Espalda apoyada: buena opción si tienes molestias lumbares.'],
      ['Elíptica', 'Cardio', 'cardio', ['quads', 'glutes'], ['hamstrings', 'calves', 'delts', 'upperback'], 'Empuja y tira de los brazos para trabajar todo el cuerpo.'],
      ['Máquina de escaleras', 'Cardio', 'cardio', ['glutes', 'quads'], ['calves', 'hamstrings'], 'No te apoyes en las barandillas y da pasos completos.'],
      ['Remo ergómetro', 'Cardio', 'cardio', ['upperback', 'lats', 'quads'], ['hamstrings', 'biceps', 'glutes'], 'Orden: piernas, tronco y brazos; para volver, al revés.']
    ]]
  ],

  // Músculos por defecto para ejercicios creados por el usuario
  GROUP_MUSCLES: {
    'Pecho': [['chest'], ['delts', 'triceps']],
    'Espalda': [['lats', 'upperback'], ['biceps', 'rear']],
    'Hombros': [['delts'], ['rear', 'traps']],
    'Bíceps y antebrazos': [['biceps'], ['forearms']],
    'Tríceps': [['triceps'], []],
    'Cuádriceps y piernas': [['quads'], ['glutes']],
    'Isquiotibiales': [['hamstrings'], ['glutes']],
    'Glúteos y abductores': [['glutes'], ['abductors', 'hamstrings']],
    'Gemelos': [['calves'], []],
    'Abdominales y core': [['abs'], ['obliques']],
    'Cardio': [['quads', 'hamstrings'], ['calves', 'glutes']]
  },

  GENERAL_EQUIPMENT: [
    'Poleas dobles / crossover',
    'Multigimnasio o multiestación',
    'Jaula de sentadillas',
    'Bancos planos',
    'Bancos inclinables',
    'Mancuernas',
    'Barras y discos',
    'Máquina Smith / multipower'
  ],

  // [nombre, kcal, proteína, carbohidratos, grasa, fibra, azúcar, grasa saturada, sodio(mg), porción g, etiqueta porción]
  FOODS: [
    // Carnes, pescados y huevos
    ['Pechuga de pollo (cruda)', 120, 22.5, 0, 2.6, 0, 0, 0.6, 60, 150, '1 filete'],
    ['Pechuga de pollo a la plancha', 165, 31, 0, 3.6, 0, 0, 1, 74, 130, '1 filete'],
    ['Muslo de pollo asado', 209, 26, 0, 10.9, 0, 0, 3, 95, 120, '1 muslo'],
    ['Pechuga de pavo (fiambre)', 105, 18, 2, 2.5, 0, 1.5, 0.8, 900, 30, '3 lonchas'],
    ['Filete de ternera', 131, 21, 0, 5, 0, 0, 2, 60, 150, '1 filete'],
    ['Carne picada mixta', 250, 17, 0, 20, 0, 0, 8, 70, 125, '1 ración'],
    ['Lomo de cerdo', 143, 21, 0, 6, 0, 0, 2, 55, 150, '1 filete'],
    ['Hamburguesa de ternera (cocinada)', 250, 20, 0, 18, 0, 0, 7, 75, 120, '1 hamburguesa'],
    ['Jamón serrano', 241, 31, 0, 13, 0, 0, 4.5, 2340, 30, '3 lonchas'],
    ['Jamón cocido', 110, 18, 1.5, 3.5, 0, 1, 1.2, 1000, 30, '3 lonchas'],
    ['Chorizo', 455, 24, 2, 38, 0, 1, 14, 1200, 30, '5 rodajas'],
    ['Salchichas tipo Frankfurt', 290, 12, 2, 26, 0, 1, 10, 950, 50, '1 salchicha'],
    ['Salmón', 208, 20, 0, 13, 0, 0, 3.1, 59, 150, '1 lomo'],
    ['Merluza', 86, 17, 0, 2, 0, 0, 0.4, 100, 150, '1 filete'],
    ['Atún al natural (lata)', 116, 26, 0, 1, 0, 0, 0.3, 320, 56, '1 lata escurrida'],
    ['Atún en aceite (escurrido)', 198, 29, 0, 8.2, 0, 0, 1.5, 350, 56, '1 lata escurrida'],
    ['Sardinas en lata', 208, 25, 0, 11, 0, 0, 1.5, 307, 85, '1 lata'],
    ['Gambas', 99, 24, 0.2, 0.3, 0, 0, 0.1, 111, 100, '1 ración'],
    ['Huevo entero', 143, 12.6, 0.7, 9.5, 0, 0.4, 3.1, 142, 60, '1 huevo'],
    ['Clara de huevo', 52, 10.9, 0.7, 0.2, 0, 0.7, 0, 166, 33, '1 clara'],
    ['Tofu firme', 144, 15, 3, 8.7, 2.3, 0.6, 1.3, 14, 100, '1 ración'],
    // Lácteos
    ['Leche entera', 63, 3.1, 4.7, 3.6, 0, 4.7, 2.3, 44, 250, '1 vaso'],
    ['Leche semidesnatada', 46, 3.2, 4.8, 1.6, 0, 4.8, 1, 44, 250, '1 vaso'],
    ['Leche desnatada', 35, 3.4, 5, 0.2, 0, 5, 0.1, 44, 250, '1 vaso'],
    ['Bebida de avena', 45, 1, 6.5, 1.5, 0.8, 3.5, 0.2, 40, 250, '1 vaso'],
    ['Yogur natural', 61, 3.5, 4.7, 3.3, 0, 4.7, 2.1, 46, 125, '1 yogur'],
    ['Yogur griego natural', 122, 3.6, 4, 10, 0, 4, 6.5, 40, 125, '1 yogur'],
    ['Skyr / yogur proteico', 63, 11, 4, 0.2, 0, 4, 0.1, 40, 150, '1 tarrina'],
    ['Queso fresco batido 0%', 46, 8, 3.5, 0.1, 0, 3.5, 0.1, 40, 250, '1 tarrina'],
    ['Queso fresco tipo Burgos', 174, 12, 3, 13, 0, 3, 8, 400, 60, '1 porción'],
    ['Queso curado', 400, 26, 0.5, 32, 0, 0.5, 20, 800, 30, '2 cuñas'],
    ['Mozzarella', 254, 18, 2.2, 19, 0, 1, 13, 450, 60, '½ bola'],
    ['Requesón / cottage', 98, 11, 3.4, 4.3, 0, 2.7, 1.7, 364, 100, '1 ración'],
    ['Proteína whey en polvo', 380, 75, 8, 5, 1, 5, 2, 200, 30, '1 cacito'],
    ['Mantequilla', 717, 0.9, 0.1, 81, 0, 0.1, 51, 11, 10, '1 porción'],
    // Cereales y tubérculos
    ['Arroz blanco (crudo)', 360, 7, 79, 0.6, 1.3, 0.1, 0.2, 1, 80, '1 ración'],
    ['Arroz blanco cocido', 130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 1, 200, '1 plato'],
    ['Arroz integral cocido', 112, 2.6, 23, 0.9, 1.8, 0.4, 0.2, 5, 200, '1 plato'],
    ['Pasta (cruda)', 357, 12.5, 72, 1.5, 3, 3, 0.3, 6, 80, '1 ración'],
    ['Pasta cocida', 158, 5.8, 31, 0.9, 1.8, 0.6, 0.2, 1, 200, '1 plato'],
    ['Pan blanco (barra)', 270, 9, 51, 3.2, 2.7, 3, 0.7, 490, 60, '1 trozo'],
    ['Pan integral', 247, 13, 41, 3.4, 7, 6, 0.7, 450, 60, '1 trozo'],
    ['Pan de molde', 265, 8, 49, 4, 2.5, 5, 0.9, 480, 28, '1 rebanada'],
    ['Copos de avena', 379, 13, 60, 6.5, 10, 1, 1.2, 6, 50, '1 ración'],
    ['Quinoa cocida', 120, 4.4, 21, 1.9, 2.8, 0.9, 0.2, 7, 150, '1 ración'],
    ['Cuscús cocido', 112, 3.8, 23, 0.2, 1.4, 0.1, 0, 5, 150, '1 ración'],
    ['Patata cocida', 87, 1.9, 20, 0.1, 1.8, 0.9, 0, 5, 200, '1 patata'],
    ['Boniato asado', 90, 2, 21, 0.2, 3.3, 6.5, 0, 36, 200, '1 boniato'],
    ['Tortitas de arroz', 387, 8, 81, 3, 4, 0.5, 0.6, 30, 9, '1 tortita'],
    ['Cereales de desayuno (copos de maíz)', 378, 7, 84, 0.9, 3, 8, 0.2, 700, 30, '1 bol'],
    ['Tortilla de trigo (wrap)', 310, 8.5, 51, 7.5, 3, 2.5, 3, 600, 60, '1 wrap'],
    // Legumbres
    ['Garbanzos cocidos', 164, 8.9, 27, 2.6, 7.6, 4.8, 0.3, 7, 200, '1 plato'],
    ['Lentejas cocidas', 116, 9, 20, 0.4, 7.9, 1.8, 0.1, 2, 200, '1 plato'],
    ['Alubias cocidas', 127, 8.7, 22.8, 0.5, 6.4, 0.3, 0.1, 2, 200, '1 plato'],
    ['Edamame', 121, 12, 9, 5, 5, 2, 0.6, 6, 100, '1 ración'],
    ['Hummus', 166, 8, 14, 9.6, 6, 0.3, 1.4, 380, 30, '2 cucharadas'],
    // Verduras
    ['Brócoli', 34, 2.8, 7, 0.4, 2.6, 1.7, 0, 33, 150, '1 ración'],
    ['Espinacas', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 79, 100, '1 ración'],
    ['Lechuga', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 0, 28, 80, '1 bol'],
    ['Tomate', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 5, 120, '1 tomate'],
    ['Pepino', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 0, 2, 100, '½ pepino'],
    ['Zanahoria', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 0, 69, 80, '1 zanahoria'],
    ['Cebolla', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 0, 4, 60, '½ cebolla'],
    ['Pimiento rojo', 31, 1, 6, 0.3, 2.1, 4.2, 0, 4, 120, '1 pimiento'],
    ['Calabacín', 17, 1.2, 3.1, 0.3, 1, 2.5, 0.1, 8, 200, '1 calabacín'],
    ['Champiñones', 22, 3.1, 3.3, 0.3, 1, 2, 0, 5, 100, '1 ración'],
    ['Judías verdes', 31, 1.8, 7, 0.2, 2.7, 3.3, 0, 6, 150, '1 ración'],
    ['Coliflor', 25, 1.9, 5, 0.3, 2, 1.9, 0.1, 30, 150, '1 ración'],
    ['Berenjena', 25, 1, 6, 0.2, 3, 3.5, 0, 2, 150, '½ berenjena'],
    ['Aguacate', 160, 2, 8.5, 14.7, 6.7, 0.7, 2.1, 7, 75, '½ aguacate'],
    ['Maíz dulce (lata)', 81, 2.9, 15, 1.2, 2.4, 4.5, 0.2, 200, 80, '1 lata pequeña'],
    ['Ensalada mixta', 40, 1.5, 5, 1.8, 1.8, 2.5, 0.3, 100, 200, '1 bol'],
    // Frutas
    ['Plátano', 89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 1, 120, '1 plátano'],
    ['Manzana', 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 1, 180, '1 manzana'],
    ['Naranja', 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 0, 150, '1 naranja'],
    ['Fresas', 32, 0.7, 7.7, 0.3, 2, 4.9, 0, 1, 150, '1 bol'],
    ['Arándanos', 57, 0.7, 14.5, 0.3, 2.4, 10, 0, 1, 80, '1 puñado'],
    ['Uvas', 69, 0.7, 18, 0.2, 0.9, 15.5, 0.1, 2, 100, '1 racimo pequeño'],
    ['Kiwi', 61, 1.1, 14.7, 0.5, 3, 9, 0, 3, 75, '1 kiwi'],
    ['Pera', 57, 0.4, 15, 0.1, 3.1, 9.8, 0, 1, 170, '1 pera'],
    ['Piña', 50, 0.5, 13, 0.1, 1.4, 9.9, 0, 1, 150, '2 rodajas'],
    ['Sandía', 30, 0.6, 7.6, 0.2, 0.4, 6.2, 0, 1, 250, '1 tajada'],
    ['Melón', 34, 0.8, 8.2, 0.2, 0.9, 7.9, 0, 16, 250, '1 tajada'],
    ['Mango', 60, 0.8, 15, 0.4, 1.6, 13.7, 0.1, 1, 200, '1 mango'],
    ['Dátiles', 282, 2.5, 75, 0.4, 8, 63, 0, 2, 8, '1 dátil'],
    // Frutos secos y grasas
    ['Almendras', 579, 21, 21.6, 49.9, 12.5, 4.4, 3.8, 1, 30, '1 puñado'],
    ['Nueces', 654, 15, 13.7, 65, 6.7, 2.6, 6.1, 2, 30, '1 puñado'],
    ['Cacahuetes', 567, 25.8, 16, 49, 8.5, 4, 6.3, 18, 30, '1 puñado'],
    ['Crema de cacahuete', 588, 25, 20, 50, 6, 6, 10, 150, 15, '1 cucharada'],
    ['Aceite de oliva', 884, 0, 0, 100, 0, 0, 14, 2, 10, '1 cucharada'],
    ['Semillas de chía', 486, 17, 42, 31, 34, 0, 3.3, 16, 15, '1 cucharada'],
    ['Chocolate negro 85%', 580, 11, 19, 46, 12, 14, 28, 20, 20, '2 onzas'],
    // Bebidas
    ['Café solo', 2, 0.1, 0, 0, 0, 0, 0, 2, 50, '1 taza'],
    ['Zumo de naranja', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 0, 1, 200, '1 vaso'],
    ['Refresco de cola', 42, 0, 10.6, 0, 0, 10.6, 0, 4, 330, '1 lata'],
    ['Refresco de cola zero', 1, 0, 0, 0, 0, 0, 0, 10, 330, '1 lata'],
    ['Cerveza', 43, 0.5, 3.6, 0, 0, 0, 0, 4, 330, '1 lata'],
    ['Vino tinto', 85, 0.1, 2.6, 0, 0, 0.6, 0, 4, 150, '1 copa'],
    // Dulces y salsas
    ['Miel', 304, 0.3, 82, 0, 0.2, 82, 0, 4, 15, '1 cucharada'],
    ['Azúcar', 387, 0, 100, 0, 0, 100, 0, 1, 8, '1 sobre'],
    ['Mermelada', 278, 0.4, 69, 0.1, 1, 48, 0, 30, 20, '1 cucharada'],
    ['Galletas tipo María', 436, 6.5, 75, 12, 2.5, 22, 5, 350, 6, '1 galleta'],
    ['Croissant', 406, 8, 46, 21, 2.6, 11, 12, 467, 60, '1 croissant'],
    ['Helado', 207, 3.5, 24, 11, 0.7, 21, 7, 80, 100, '1 bola grande'],
    ['Mayonesa', 680, 1, 1, 75, 0, 0.6, 11, 630, 15, '1 cucharada'],
    ['Kétchup', 112, 1.2, 26, 0.1, 0.3, 22, 0, 907, 15, '1 cucharada'],
    ['Barrita proteica', 350, 33, 35, 11, 10, 3, 5, 250, 60, '1 barrita'],
    // Platos
    ['Tortilla de patata', 197, 6.5, 15, 12, 1.5, 1, 2.5, 330, 150, '1 pincho'],
    ['Pizza margarita', 250, 11, 30, 10, 2, 3.5, 4.5, 600, 120, '1 porción'],
    ['Paella', 155, 7, 22, 4.5, 1, 1, 1, 350, 300, '1 plato'],
    ['Lentejas estofadas con chorizo', 130, 7, 13, 5.5, 4, 1.5, 2, 400, 300, '1 plato'],
    ['Gazpacho', 46, 0.9, 4.2, 3, 1, 3, 0.4, 330, 250, '1 vaso'],
    ['Patatas fritas caseras', 312, 3.4, 41, 15, 3.8, 0.3, 2.3, 210, 150, '1 ración'],
    ['Patatas fritas de bolsa', 536, 7, 53, 34, 4.8, 0.5, 3.5, 525, 30, '1 bolsa pequeña']
  ]
};
