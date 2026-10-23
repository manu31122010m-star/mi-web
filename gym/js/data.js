/* Biblioteca de ejercicios, material del gimnasio y plantillas de rutinas */
'use strict';
window.GYMDATA = (function () {
  const MUSCLES = {
    chest: 'Pecho', delts: 'Hombro (deltoides)', rear: 'Deltoides posterior', traps: 'Trapecio', lats: 'Dorsal ancho',
    upperback: 'Espalda media', lowerback: 'Lumbares', biceps: 'Bíceps', triceps: 'Tríceps', forearms: 'Antebrazos',
    abs: 'Abdominales', obliques: 'Oblicuos', quads: 'Cuádriceps', hamstrings: 'Isquiotibiales', glutes: 'Glúteos',
    adductors: 'Aductores', abductors: 'Abductores', calves: 'Gemelos', tibialis: 'Tibial anterior', rotator: 'Manguito rotador'
  };

  const EQUIP = {
    maquina: ['Máquinas guiadas', '⚙️'],
    polea: ['Polea / torre de cable', '🪢'],
    crossover: ['Poleas dobles / crossover', '↔️'],
    multi: ['Multigimnasio / multiestación', '🏗️'],
    smith: ['Máquina Smith / multipower', '🛤️'],
    jaula: ['Jaula de sentadillas', '🔲'],
    banco: ['Bancos planos', '🛋️'],
    bancoInc: ['Bancos inclinables', '📐'],
    manc: ['Mancuernas', '🏋️'],
    barra: ['Barras y discos', '🥏'],
    cardio: ['Máquinas de cardio', '🏃'],
    cuerpo: ['Peso corporal', '🤸'],
    kb: ['Kettlebell', '🔔'],
    banda: ['Banda elástica', '➰'],
    fitball: ['Fitball / balón', '⚪'],
    anillas: ['Anillas / TRX', '⭕'],
    cajon: ['Cajón / escalón', '📦'],
    comba: ['Comba', '🪢'],
    otros: ['Material funcional (trineo, cuerdas, rueda…)', '🧰']
  };

  const GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps y antebrazos', 'Tríceps', 'Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos', 'Abdominales y core', 'Cuerpo completo y funcional', 'Cardio'];
  const GROUP_ICON = { 'Pecho': '🫁', 'Espalda': '🦅', 'Hombros': '🥥', 'Bíceps y antebrazos': '💪', 'Tríceps': '🔱', 'Cuádriceps y piernas': '🦵', 'Isquiotibiales': '🦿', 'Glúteos y abductores': '🍑', 'Gemelos': '🦶', 'Abdominales y core': '🧱', 'Cuerpo completo y funcional': '⚡', 'Cardio': '❤️' };

  // [nombre, animación, material, principales, secundarios, tipo, pasos, errores]
  // tipo: r = peso × reps · a = máquina asistida (kg de ayuda) · b = peso corporal · t = tiempo · c = cardio
  const RAW = {
    'Pecho': [
      ['Press de pecho sentado', 'chestPress', ['maquina'], ['chest'], ['delts', 'triceps'], 'r',
        ['Ajusta el asiento para que las asas queden a la altura de la mitad del pecho.', 'Espalda y cabeza apoyadas, escápulas juntas y pecho alto.', 'Empuja hacia delante sin bloquear del todo los codos.', 'Vuelve en 2–3 s hasta notar el estiramiento del pecho.'],
        ['Despegar la espalda del respaldo', 'Subir los hombros hacia las orejas']],
      ['Press de pecho inclinado', 'inclineMachine', ['maquina'], ['chest'], ['delts', 'triceps'], 'r',
        ['Asiento bajo: las asas deben salir a la altura del pecho alto.', 'Pecho arriba y escápulas atrás.', 'Empuja hacia arriba y adelante siguiendo el recorrido de la máquina.', 'Baja controlando sin que las placas choquen.'],
        ['Arquear en exceso la zona lumbar', 'Codos totalmente abiertos a 90°']],
      ['Contractora / Pec Deck', 'pecDeck', ['maquina'], ['chest'], ['delts'], 'r',
        ['Antebrazos apoyados en los cojines, codos a la altura de los hombros.', 'Junta los brazos delante del pecho llevando los codos hacia el centro.', 'Aprieta 1 segundo en el cierre.', 'Abre despacio hasta notar el estiramiento.'],
        ['Empujar con las manos en lugar de con los codos', 'Abrir demasiado y forzar el hombro']],
      ['Máquina de aperturas', 'flyMachine', ['maquina'], ['chest'], ['delts'], 'r',
        ['Brazos casi estirados con los codos ligeramente flexionados.', 'Cierra los brazos en un arco amplio hacia el centro.', 'No dejes que las asas choquen: mantén la tensión.', 'Abre lento hasta la línea del pecho.'],
        ['Doblar los codos y convertirlo en un press', 'Usar impulso']],
      ['Cruce de poleas', 'crossover', ['crossover', 'polea'], ['chest'], ['delts'], 'r',
        ['Poleas en posición alta, un paso al frente y torso ligeramente inclinado.', 'Codos semiflexionados y fijos durante todo el movimiento.', 'Lleva las manos hacia abajo y al centro dibujando un arco.', 'Cruza un poco las manos, aprieta y vuelve controlando.'],
        ['Mover los codos (se convierte en press)', 'Balancear el cuerpo']],
      ['Press de pecho convergente', 'convergent', ['maquina'], ['chest'], ['delts', 'triceps'], 'r',
        ['Asas a la altura del pecho medio, espalda apoyada.', 'Empuja: las asas se acercan entre sí al avanzar.', 'Aprieta el pecho al final del recorrido.', 'Baja en 2–3 s.'],
        ['Rebotar abajo', 'Bloquear los codos con fuerza']],
      ['Press de banca con barra', 'benchPress', ['barra', 'banco', 'jaula'], ['chest'], ['triceps', 'delts'], 'r',
        ['Ojos bajo la barra, escápulas juntas y pies firmes en el suelo.', 'Agarre algo más ancho que los hombros.', 'Baja la barra a la parte baja del pecho con los codos a unos 45°.', 'Empuja hacia arriba y ligeramente hacia la cara.'],
        ['Rebotar la barra en el pecho', 'Levantar los glúteos del banco']],
      ['Press con mancuernas en banco plano', 'dbBench', ['manc', 'banco'], ['chest'], ['triceps', 'delts'], 'r',
        ['Túmbate con las mancuernas sobre el pecho y los pies apoyados.', 'Baja hasta que los codos queden un poco por debajo del banco.', 'Empuja juntando ligeramente las mancuernas arriba.', 'Controla la bajada.'],
        ['Bajar demasiado rápido', 'Codos pegados al cuerpo']],
      ['Press inclinado con mancuernas', 'inclineDb', ['manc', 'bancoInc'], ['chest'], ['delts', 'triceps'], 'r',
        ['Banco a 30–45°.', 'Mancuernas a los lados del pecho alto.', 'Empuja hacia arriba hasta casi juntar las mancuernas.', 'Baja lento.'],
        ['Inclinación excesiva (trabaja sobre todo hombro)']],
      ['Aperturas con mancuernas', 'dbFly', ['manc', 'banco'], ['chest'], ['delts'], 'r',
        ['Brazos arriba con codos ligeramente flexionados.', 'Abre en arco hasta notar el estiramiento.', 'Cierra como si abrazaras un árbol.'],
        ['Bajar con peso demasiado alto', 'Estirar del todo los codos']]
    ],
    'Espalda': [
      ['Jalón al pecho', 'latPulldown', ['polea', 'multi'], ['lats'], ['biceps', 'upperback', 'rear'], 'r',
        ['Ajusta el rodillo sobre los muslos y agarra la barra algo más ancho que los hombros.', 'Pecho arriba e inclínate un poco hacia atrás.', 'Tira llevando los codos hacia abajo y atrás hasta la clavícula.', 'Sube controlando hasta estirar los brazos.'],
        ['Tirar detrás de la nuca', 'Balancear el torso para mover más peso']],
      ['Jalón con agarre estrecho', 'closePulldown', ['polea', 'multi'], ['lats'], ['biceps', 'upperback'], 'r',
        ['Agarre neutro (palmas enfrentadas) con el triángulo.', 'Tira hacia la parte baja del pecho.', 'Codos pegados al cuerpo y hacia las costillas.', 'Estira del todo arriba.'],
        ['Encoger los hombros', 'Recorrido corto']],
      ['Remo sentado en polea', 'seatedRow', ['polea', 'multi'], ['upperback', 'lats'], ['biceps', 'rear', 'lowerback'], 'r',
        ['Pies en la plataforma con las rodillas algo flexionadas.', 'Espalda neutra y pecho alto.', 'Lleva el agarre al abdomen juntando las escápulas.', 'Vuelve estirando los brazos sin redondear la espalda.'],
        ['Balancear el torso adelante y atrás', 'Redondear la zona lumbar']],
      ['Remo con pecho apoyado', 'chestRow', ['maquina'], ['upperback', 'lats'], ['rear', 'biceps'], 'r',
        ['Pecho bien apoyado en el cojín.', 'Agarra las asas con los brazos estirados.', 'Tira con los codos hacia atrás y aprieta las escápulas.', 'Estira despacio.'],
        ['Despegar el pecho del apoyo', 'Tirar solo con los brazos']],
      ['Remo unilateral en máquina', 'rowUni', ['maquina'], ['upperback', 'lats'], ['rear', 'biceps'], 'r',
        ['Pecho apoyado, un brazo cada vez.', 'Tira del asa llevando el codo atrás y pegado al cuerpo.', 'Aprieta la escápula al final.', 'Haz las mismas repeticiones con cada lado.'],
        ['Girar el tronco para ayudar']],
      ['Pullover en máquina', 'pullover', ['maquina'], ['lats'], ['chest', 'triceps'], 'r',
        ['Hombros alineados con el eje de la máquina.', 'Apoya los codos/brazos en los cojines con los brazos arriba.', 'Lleva los brazos hacia abajo en arco hasta los muslos.', 'Sube lento notando el estiramiento del dorsal.'],
        ['Doblar mucho los codos', 'Arquear la espalda']],
      ['Máquina de dominadas asistidas', 'assistedPullup', ['maquina'], ['lats'], ['biceps', 'upperback'], 'a',
        ['Elige el peso de ayuda: más kilos = más fácil.', 'Rodillas en la plataforma y agarre algo más ancho que los hombros.', 'Sube hasta que la barbilla pase el agarre.', 'Baja hasta estirar los brazos.'],
        ['Rebotar abajo', 'Medio recorrido']],
      ['Extensiones lumbares', 'backExt', ['maquina', 'cuerpo'], ['lowerback'], ['glutes', 'hamstrings'], 'b',
        ['Cadera apoyada justo por debajo del borde del cojín.', 'Brazos cruzados en el pecho.', 'Baja el torso con la espalda neutra.', 'Sube hasta quedar en línea con las piernas, sin hiperextender.'],
        ['Subir de golpe', 'Arquear de más arriba']],
      ['Dominadas', 'pullup', ['multi', 'jaula', 'cuerpo'], ['lats'], ['biceps', 'upperback'], 'b',
        ['Cuelga con agarre prono algo más ancho que los hombros.', 'Lleva el pecho hacia la barra tirando con los codos.', 'Baja controlando hasta estirar los brazos.'],
        ['Balancearse', 'No bajar del todo']],
      ['Remo con barra', 'bentRow', ['barra'], ['upperback', 'lats'], ['biceps', 'lowerback', 'rear'], 'r',
        ['Inclina el torso unos 45° con la espalda recta y rodillas flexionadas.', 'Tira de la barra hacia el ombligo.', 'Baja estirando los brazos sin mover el torso.'],
        ['Redondear la espalda', 'Levantarse con cada repetición']],
      ['Remo con mancuerna a una mano', 'dbRow', ['manc', 'banco'], ['upperback', 'lats'], ['biceps', 'rear'], 'r',
        ['Rodilla y mano del mismo lado sobre el banco.', 'Espalda paralela al suelo.', 'Tira de la mancuerna hacia la cadera.', 'Baja estirando el brazo.'],
        ['Girar el tronco', 'Tirar hacia el hombro']],
      ['Peso muerto con barra', 'deadlift', ['barra'], ['lowerback', 'glutes', 'hamstrings'], ['quads', 'traps', 'forearms'], 'r',
        ['Barra sobre el medio del pie y espinillas cerca.', 'Agarra la barra, pecho arriba y espalda neutra.', 'Empuja el suelo con las piernas y extiende cadera a la vez.', 'Baja la barra pegada a las piernas.'],
        ['Redondear la espalda', 'Separar la barra del cuerpo']]
    ],
    'Hombros': [
      ['Press de hombros', 'shoulderPress', ['maquina'], ['delts'], ['triceps', 'traps'], 'r',
        ['Asas a la altura de los hombros y espalda apoyada.', 'Empuja hacia arriba sin bloquear los codos.', 'Baja hasta que las manos queden a la altura de la barbilla.'],
        ['Arquear la espalda', 'Bajar demasiado poco']],
      ['Elevaciones laterales en máquina', 'lateralMachine', ['maquina'], ['delts'], ['traps'], 'r',
        ['Eje de la máquina alineado con el hombro.', 'Cojines por fuera de los brazos, cerca del codo.', 'Sube los codos hasta la altura de los hombros.', 'Baja despacio.'],
        ['Encoger los hombros', 'Subir por encima de los hombros']],
      ['Pájaros / deltoide posterior', 'rearDelt', ['maquina'], ['rear'], ['upperback', 'traps'], 'r',
        ['En la contractora mirando hacia el respaldo, asas a la altura de los hombros.', 'Brazos casi estirados.', 'Abre hacia atrás hasta la línea del cuerpo.', 'Vuelve controlando.'],
        ['Juntar las escápulas en exceso', 'Usar impulso']],
      ['Polea para elevaciones laterales', 'cableLateral', ['polea', 'crossover'], ['delts'], ['traps'], 'r',
        ['Polea baja, de lado a la torre, cable por delante del cuerpo.', 'Codo ligeramente flexionado.', 'Sube el brazo hacia el lado hasta la altura del hombro.', 'Baja lento. Cambia de lado.'],
        ['Inclinar el cuerpo', 'Subir con el trapecio']],
      ['Encogimientos para trapecio', 'shrug', ['manc', 'barra', 'smith'], ['traps'], ['forearms'], 'r',
        ['De pie, brazos estirados con el peso a los lados.', 'Sube los hombros hacia las orejas.', 'Mantén 1 s arriba.', 'Baja del todo.'],
        ['Girar los hombros en círculos', 'Doblar los codos']],
      ['Press de hombros con mancuernas', 'dbShoulder', ['manc', 'bancoInc'], ['delts'], ['triceps', 'traps'], 'r',
        ['Banco con respaldo vertical.', 'Mancuernas a la altura de las orejas.', 'Empuja hacia arriba hasta casi juntarlas.', 'Baja controlando.'],
        ['Arquear la espalda']],
      ['Elevaciones laterales con mancuernas', 'dbLateral', ['manc'], ['delts'], ['traps'], 'r',
        ['De pie, mancuernas a los lados.', 'Sube los brazos hacia los lados con los codos algo flexionados.', 'Para a la altura de los hombros.', 'Baja despacio.'],
        ['Balancear el cuerpo', 'Peso excesivo']]
    ],
    'Bíceps y antebrazos': [
      ['Curl de bíceps en máquina', 'machineCurl', ['maquina'], ['biceps'], ['forearms'], 'r',
        ['Codos alineados con el eje de la máquina y axilas en el borde del cojín.', 'Sube flexionando los codos.', 'Aprieta arriba.', 'Baja hasta casi estirar.'],
        ['Levantar los codos del cojín', 'Medio recorrido']],
      ['Banco Scott para bíceps', 'preacher', ['banco', 'barra', 'manc'], ['biceps'], ['forearms'], 'r',
        ['Brazos apoyados en el cojín inclinado.', 'Agarra la barra con las palmas hacia arriba.', 'Sube sin despegar los brazos.', 'Baja lento sin bloquear de golpe.'],
        ['Rebotar abajo', 'Levantar los hombros']],
      ['Polea baja para curl', 'cableCurl', ['polea', 'crossover'], ['biceps'], ['forearms'], 'r',
        ['Polea baja con barra o cuerda, de pie frente a la torre.', 'Codos pegados al cuerpo.', 'Sube flexionando los codos.', 'Baja controlando.'],
        ['Adelantar los codos', 'Balancear la espalda']],
      ['Máquina de antebrazos', 'forearm', ['maquina'], ['forearms'], [], 'r',
        ['Antebrazos apoyados, muñecas fuera del cojín.', 'Flexiona las muñecas hacia arriba.', 'Baja hasta notar el estiramiento.'],
        ['Mover los codos']],
      ['Curl con mancuernas', 'dbCurl', ['manc'], ['biceps'], ['forearms'], 'r',
        ['De pie, mancuernas a los lados con las palmas al frente.', 'Sube una y otra alternando.', 'Codos fijos junto al cuerpo.', 'Baja lento.'],
        ['Balanceo', 'Subir los codos']]
    ],
    'Tríceps': [
      ['Extensión de tríceps en polea', 'pushdown', ['polea', 'crossover'], ['triceps'], [], 'r',
        ['Polea alta con barra, codos pegados al cuerpo.', 'Empuja hacia abajo hasta estirar los brazos.', 'Aprieta el tríceps abajo.', 'Sube hasta 90° sin mover los codos.'],
        ['Separar los codos', 'Inclinarse encima de la barra']],
      ['Máquina de fondos asistidos', 'assistedDip', ['maquina'], ['triceps'], ['chest', 'delts'], 'a',
        ['Elige el peso de ayuda: más kilos = más fácil.', 'Rodillas en la plataforma, manos en los agarres.', 'Baja hasta que los codos estén a unos 90°.', 'Empuja hasta estirar los brazos.'],
        ['Bajar demasiado', 'Hombros hacia delante']],
      ['Extensión de tríceps sentado', 'overheadExt', ['maquina'], ['triceps'], [], 'r',
        ['Siéntate con los codos apoyados y alineados con el eje.', 'Estira los brazos por completo.', 'Vuelve despacio hasta notar el estiramiento.'],
        ['Abrir los codos', 'Usar impulso']],
      ['Polea alta con cuerda', 'ropePushdown', ['polea', 'crossover'], ['triceps'], [], 'r',
        ['Polea alta con cuerda.', 'Codos pegados, empuja hacia abajo.', 'Abre la cuerda al final del recorrido.', 'Sube controlando.'],
        ['Mover los hombros']],
      ['Fondos en máquina (sentado)', 'machineDip', ['maquina'], ['triceps'], ['chest'], 'r',
        ['Asas a la altura del pecho, espalda apoyada.', 'Empuja hacia abajo hasta estirar los brazos.', 'Sube lento.'],
        ['Encoger los hombros']],
      ['Fondos en paralelas', 'dips', ['multi', 'cuerpo'], ['triceps', 'chest'], ['delts'], 'b',
        ['Brazos estirados sobre las paralelas.', 'Baja flexionando los codos hasta unos 90°.', 'Empuja hasta arriba.'],
        ['Bajar demasiado', 'Balancear las piernas']]
    ],
    'Cuádriceps y piernas': [
      ['Prensa de piernas', 'legPress', ['maquina'], ['quads', 'glutes'], ['hamstrings', 'adductors'], 'r',
        ['Espalda y cadera pegadas al respaldo.', 'Pies a la anchura de la cadera en el centro de la plataforma.', 'Baja hasta unos 90° de rodilla sin despegar la cadera.', 'Empuja sin bloquear las rodillas.'],
        ['Despegar la zona lumbar abajo', 'Rodillas hacia dentro']],
      ['Extensión de cuádriceps', 'legExt', ['maquina'], ['quads'], [], 'r',
        ['Rodilla alineada con el eje de la máquina.', 'Rodillo sobre el tobillo.', 'Estira las piernas y aprieta 1 s.', 'Baja despacio.'],
        ['Dar patadas', 'Despegar la cadera del asiento']],
      ['Sentadilla Hack', 'hackSquat', ['maquina'], ['quads'], ['glutes', 'adductors'], 'r',
        ['Espalda pegada al respaldo, hombros bajo los cojines.', 'Pies a la anchura de los hombros.', 'Baja hasta 90° o más con control.', 'Sube empujando con toda la planta.'],
        ['Levantar los talones', 'Rodillas hacia dentro']],
      ['Sentadilla en Smith', 'smithSquat', ['smith'], ['quads', 'glutes'], ['hamstrings', 'lowerback'], 'r',
        ['Barra sobre los trapecios, pies algo adelantados.', 'Desbloquea la barra girando las muñecas.', 'Baja como si te sentaras.', 'Sube empujando el suelo.'],
        ['Redondear la espalda', 'Bajar poco']],
      ['Sentadilla en máquina', 'machineSquat', ['maquina'], ['quads', 'glutes'], ['hamstrings'], 'r',
        ['Hombros bajo los cojines y espalda recta.', 'Baja controlando hasta muslos paralelos.', 'Sube sin bloquear rodillas.'],
        ['Talones despegados']],
      ['Extensión unilateral de piernas', 'legExtUni', ['maquina'], ['quads'], [], 'r',
        ['Igual que la extensión, pero con una pierna.', 'Estira la pierna y aprieta.', 'Baja lento y cambia de lado.'],
        ['Girar la cadera']],
      ['Sentadilla con barra', 'backSquat', ['barra', 'jaula'], ['quads', 'glutes'], ['hamstrings', 'lowerback', 'adductors'], 'r',
        ['Barra en los trapecios, sal de los soportes con dos pasos.', 'Pies a la anchura de los hombros, puntas algo abiertas.', 'Baja con el pecho alto hasta romper el paralelo.', 'Sube empujando el suelo. Pon los seguros de la jaula.'],
        ['Rodillas hacia dentro', 'Redondear la espalda']],
      ['Sentadilla péndulo', 'pendulum', ['maquina'], ['quads'], ['glutes'], 'r',
        ['Espalda en el respaldo, hombros bajo los cojines.', 'Baja profundo con las rodillas hacia delante.', 'Sube sin bloquear.'],
        ['Despegar talones']],
      ['Zancadas con mancuernas', 'lunge', ['manc', 'cuerpo'], ['quads', 'glutes'], ['hamstrings', 'adductors'], 'r',
        ['Un pie adelante y otro atrás, torso recto.', 'Baja la rodilla de atrás hacia el suelo.', 'Sube empujando con la pierna delantera.', 'Cambia de pierna.'],
        ['Rodilla delantera hacia dentro', 'Paso muy corto']]
    ],
    'Isquiotibiales': [
      ['Curl femoral sentado', 'seatedCurl', ['maquina'], ['hamstrings'], ['calves'], 'r',
        ['Rodilla alineada con el eje, rodillo encima de los muslos bien ajustado.', 'Rodillo inferior detrás del tobillo.', 'Flexiona las rodillas llevando el rodillo hacia abajo.', 'Vuelve despacio.'],
        ['Despegar la cadera', 'Recorrido corto']],
      ['Curl femoral tumbado', 'lyingCurl', ['maquina'], ['hamstrings'], ['calves'], 'r',
        ['Boca abajo, rodillas justo fuera del banco.', 'Rodillo sobre los talones.', 'Lleva los talones hacia los glúteos.', 'Baja controlando.'],
        ['Levantar la cadera del banco']],
      ['Curl femoral de pie', 'standingCurl', ['maquina'], ['hamstrings'], ['calves'], 'r',
        ['De pie, rodilla apoyada en el cojín.', 'Rodillo detrás del tobillo.', 'Flexiona la rodilla subiendo el talón.', 'Baja lento y cambia de pierna.'],
        ['Mover la cadera']],
      ['Peso muerto en Smith', 'smithRDL', ['smith'], ['hamstrings', 'glutes'], ['lowerback', 'forearms'], 'r',
        ['De pie con la barra en las manos y las rodillas algo flexionadas.', 'Lleva la cadera hacia atrás manteniendo la espalda recta.', 'Baja hasta notar el estiramiento de los isquios.', 'Sube empujando la cadera adelante.'],
        ['Redondear la espalda', 'Doblar mucho las rodillas']],
      ['Peso muerto rumano con mancuernas', 'dbRDL', ['manc'], ['hamstrings', 'glutes'], ['lowerback'], 'r',
        ['Mancuernas delante de los muslos.', 'Cadera atrás con espalda recta.', 'Baja hasta media tibia y sube apretando glúteo.'],
        ['Redondear la espalda']]
    ],
    'Glúteos y abductores': [
      ['Máquina de abductores', 'abductor', ['maquina'], ['abductors', 'glutes'], [], 'r',
        ['Siéntate con la espalda apoyada y los cojines por fuera de las rodillas.', 'Abre las piernas hacia fuera.', 'Aprieta 1 s.', 'Cierra despacio.'],
        ['Usar impulso', 'Despegar la espalda']],
      ['Máquina de aductores', 'adductor', ['maquina'], ['adductors'], [], 'r',
        ['Cojines por dentro de las rodillas.', 'Junta las piernas.', 'Abre despacio hasta un estiramiento cómodo.'],
        ['Abrir más de lo cómodo']],
      ['Patada de glúteo en máquina', 'kickbackMachine', ['maquina'], ['glutes'], ['hamstrings'], 'r',
        ['Pecho en el apoyo y manos en los agarres.', 'Empuja la plataforma hacia atrás con el talón.', 'Aprieta el glúteo arriba.', 'Vuelve lento y cambia de pierna.'],
        ['Arquear la zona lumbar']],
      ['Polea para patada de glúteo', 'cableKickback', ['polea', 'crossover'], ['glutes'], ['hamstrings'], 'r',
        ['Tobillera en la polea baja, frente a la torre.', 'Inclina un poco el torso y agárrate.', 'Lleva la pierna hacia atrás con el talón.', 'Vuelve controlando y cambia de pierna.'],
        ['Girar la cadera', 'Arquear la espalda']],
      ['Máquina de hip thrust', 'hipThrust', ['maquina'], ['glutes'], ['hamstrings', 'quads'], 'r',
        ['Espalda alta en el respaldo y cinturón sobre la cadera.', 'Pies a la anchura de la cadera.', 'Sube la cadera hasta quedar recto de hombros a rodillas.', 'Aprieta 1 s y baja.'],
        ['Hiperextender la espalda', 'Empujar con la punta de los pies']],
      ['Prensa con énfasis en glúteos', 'gluteLegPress', ['maquina'], ['glutes'], ['hamstrings', 'quads'], 'r',
        ['Pies altos y algo más abiertos en la plataforma.', 'Baja profundo sin despegar la cadera.', 'Empuja con los talones.'],
        ['Despegar la cadera abajo']],
      ['Hip thrust con barra', 'bbHipThrust', ['barra', 'banco'], ['glutes'], ['hamstrings'], 'r',
        ['Espalda alta en el banco, barra sobre la cadera con almohadilla.', 'Sube la cadera hasta la horizontal.', 'Aprieta y baja.'],
        ['Mirar al techo y arquear']]
    ],
    'Gemelos': [
      ['Elevación de gemelos sentado', 'seatedCalf', ['maquina'], ['calves'], [], 'r',
        ['Almohadilla sobre los muslos cerca de las rodillas.', 'Puntas de los pies en el escalón.', 'Sube los talones todo lo posible.', 'Baja hasta estirar.'],
        ['Rebotar', 'Recorrido corto']],
      ['Elevación de gemelos de pie', 'standingCalf', ['maquina', 'smith'], ['calves'], [], 'r',
        ['Hombros bajo los cojines, puntas en el escalón.', 'Rodillas estiradas sin bloquear.', 'Sube de puntillas.', 'Baja despacio por debajo del escalón.'],
        ['Doblar las rodillas']],
      ['Gemelos en prensa', 'calfPress', ['maquina'], ['calves'], [], 'r',
        ['En la prensa, solo las puntas en la parte baja de la plataforma.', 'Piernas casi estiradas.', 'Empuja con las puntas.', 'Vuelve hasta estirar.'],
        ['Doblar las rodillas', 'Quitar los seguros sin control']]
    ],
    'Abdominales y core': [
      ['Máquina de abdominales', 'abMachine', ['maquina'], ['abs'], ['obliques'], 'r',
        ['Agarra las asas o apoya los codos en los cojines.', 'Flexiona el tronco llevando el pecho hacia la cadera.', 'Exhala y aprieta abajo.', 'Vuelve lento.'],
        ['Tirar con los brazos']],
      ['Máquina de rotación de tronco', 'rotation', ['maquina'], ['obliques'], ['abs'], 'r',
        ['Siéntate con la cadera fija.', 'Gira el tronco hacia un lado de forma controlada.', 'Vuelve al centro despacio.', 'Haz ambos lados.'],
        ['Girar de golpe']],
      ['Banco de abdominales', 'declineSitup', ['bancoInc', 'cuerpo'], ['abs'], ['obliques'], 'b',
        ['Pies sujetos bajo los rodillos.', 'Baja el tronco controlando.', 'Sube enrollando la columna.'],
        ['Tirar del cuello']],
      ['Silla romana / elevación de piernas', 'legRaise', ['multi', 'cuerpo'], ['abs'], ['obliques'], 'b',
        ['Espalda en el respaldo y antebrazos en los apoyos.', 'Sube las rodillas hacia el pecho.', 'Baja sin balancear.'],
        ['Balancearse', 'Arquear la espalda']],
      ['Polea para crunch abdominal', 'cableCrunch', ['polea', 'crossover'], ['abs'], ['obliques'], 'r',
        ['De rodillas frente a la polea alta, cuerda junto a la cabeza.', 'Flexiona el tronco llevando los codos a los muslos.', 'Aprieta y vuelve despacio.'],
        ['Mover la cadera en lugar del tronco']],
      ['Plancha', 'plank', ['cuerpo'], ['abs'], ['obliques', 'delts'], 't',
        ['Antebrazos bajo los hombros.', 'Cuerpo en línea recta, glúteos y abdomen apretados.', 'Respira y mantén.'],
        ['Cadera hundida', 'Cadera demasiado alta']]
    ],
    'Cardio': [
      ['Cinta de correr', 'treadmill', ['cardio'], ['quads', 'calves'], ['hamstrings', 'glutes'], 'c',
        ['Empieza caminando 3–5 min.', 'Sube la velocidad o la inclinación poco a poco.', 'Mira al frente y no te agarres a las barras.', 'Termina caminando.'],
        ['Agarrarse a la cinta con inclinación']],
      ['Bicicleta estática', 'bike', ['cardio'], ['quads'], ['hamstrings', 'calves', 'glutes'], 'c',
        ['Sillín a la altura de la cadera.', 'Rodilla casi estirada abajo.', 'Mantén un ritmo constante.'],
        ['Sillín demasiado bajo']],
      ['Bicicleta reclinada', 'recumbent', ['cardio'], ['quads'], ['hamstrings', 'glutes'], 'c',
        ['Ajusta el asiento para que la rodilla quede casi estirada.', 'Espalda apoyada.', 'Pedalea a ritmo constante.'],
        ['Asiento demasiado cerca']],
      ['Elíptica', 'elliptical', ['cardio'], ['quads', 'glutes'], ['hamstrings', 'chest', 'upperback'], 'c',
        ['Pies completos en los pedales.', 'Empuja y tira de las asas.', 'Torso recto.'],
        ['Apoyarse sobre las asas']],
      ['Máquina de escaleras', 'stairs', ['cardio'], ['glutes', 'quads'], ['calves', 'hamstrings'], 'c',
        ['Pisa con todo el pie en cada escalón.', 'Torso recto, manos solo como apoyo.', 'Ritmo que puedas mantener.'],
        ['Colgarse de las barras']],
      ['Remo ergómetro', 'rower', ['cardio'], ['upperback', 'quads'], ['lats', 'biceps', 'glutes', 'hamstrings'], 'c',
        ['Orden: piernas, espalda y brazos.', 'En la vuelta: brazos, espalda y piernas.', 'Espalda recta en todo momento.'],
        ['Tirar solo con los brazos', 'Encorvarse']]
    ]
  };

  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const EXERCISES = [];
  for (const g of GROUPS) for (const [n, a, e, p, s, t, steps, errs] of RAW[g] || []) EXERCISES.push({ id: slug(n), n, g, a, e, p, s, t, steps, errs });

  // Lista completa por grupo y subgrupo (data-extra.js)
  const X = window.GYMDATA_EXTRA || { SUB: {}, VAR: {}, ALSO: {}, NEW: {} };
  const DEFAULT_SUB = { 'Pecho': 'Pectoral medio (plano)', 'Espalda': 'Espalda media y grosor (tirón horizontal)', 'Hombros': 'Deltoides anterior', 'Bíceps y antebrazos': 'Bíceps', 'Tríceps': 'Tríceps', 'Cuádriceps y piernas': 'Cuádriceps', 'Isquiotibiales': 'Isquiotibiales', 'Glúteos y abductores': 'Glúteo mayor', 'Gemelos': 'Gemelos y sóleo', 'Abdominales y core': 'Recto abdominal', 'Cuerpo completo y funcional': 'Cuerpo completo y funcional', 'Cardio': 'Cardio' };
  EXERCISES.forEach(e => { e.sg = X.SUB[e.id] || DEFAULT_SUB[e.g]; if (X.VAR[e.id]) e.v = X.VAR[e.id]; });
  for (const g of GROUPS) for (const [sg, n, a, e, p, s, t, steps, errs, v] of (X.NEW[g] || [])) {
    const id = slug(n);
    if (EXERCISES.some(x => x.id === id)) continue;
    EXERCISES.push({ id, n, g, sg, a, e, p, s, t, steps, errs, ...(v ? { v } : {}) });
  }
  for (const [n, list] of Object.entries(X.ALSO || {})) { const e = EXERCISES.find(x => x.id === slug(n)); if (e) e.also = list; }
  // Los encogimientos van con el trapecio (Espalda), como en la lista por grupos
  const shrug = EXERCISES.find(x => x.id === 'encogimientos-para-trapecio');
  if (shrug) { shrug.g = 'Espalda'; shrug.sg = 'Trapecio y romboides'; }
  EXERCISES.sort((a, b) => GROUPS.indexOf(a.g) - GROUPS.indexOf(b.g));
  // Subgrupos en el orden en que aparecen
  const SUB_ORDER = ['Pectoral medio (plano)', 'Pectoral superior (inclinado)', 'Pectoral inferior (declinado)', 'Aislamiento', 'Dorsal ancho (tirón vertical)', 'Espalda media y grosor (tirón horizontal)', 'Trapecio y romboides', 'Lumbares y cadena posterior', 'Deltoides anterior', 'Deltoides lateral', 'Deltoides posterior', 'Manguito rotador y estabilidad', 'Bíceps', 'Antebrazos', 'Recto abdominal', 'Oblicuos', 'Core profundo y estabilidad', 'Glúteo mayor', 'Glúteo medio y menor', 'Aductores', 'Abductores', 'Gemelos y sóleo', 'Tibial anterior'];
  const SUBGROUPS = {};
  EXERCISES.forEach(e => { (SUBGROUPS[e.g] = SUBGROUPS[e.g] || []).includes(e.sg) || SUBGROUPS[e.g].push(e.sg); (e.also || []).forEach(([g, sg]) => { (SUBGROUPS[g] = SUBGROUPS[g] || []).includes(sg) || SUBGROUPS[g].push(sg); }); });
  Object.values(SUBGROUPS).forEach(l => l.sort((a, b) => (SUB_ORDER.indexOf(a) + 1 || 99) - (SUB_ORDER.indexOf(b) + 1 || 99)));

  // Plantillas opcionales (el usuario decide si las añade)
  const TEMPLATES = [
    { name: 'Empuje (pecho, hombro, tríceps)', color: '#ff6b81', items: ['press-de-pecho-sentado', 'press-de-pecho-inclinado', 'contractora-pec-deck', 'press-de-hombros', 'elevaciones-laterales-en-maquina', 'extension-de-triceps-en-polea', 'polea-alta-con-cuerda'] },
    { name: 'Tirón (espalda y bíceps)', color: '#5ad1ff', items: ['jalon-al-pecho', 'remo-sentado-en-polea', 'remo-con-pecho-apoyado', 'pullover-en-maquina', 'pajaros-deltoide-posterior', 'curl-de-biceps-en-maquina', 'polea-baja-para-curl'] },
    { name: 'Pierna completa', color: '#7be495', items: ['prensa-de-piernas', 'sentadilla-hack', 'extension-de-cuadriceps', 'curl-femoral-sentado', 'curl-femoral-tumbado', 'maquina-de-hip-thrust', 'elevacion-de-gemelos-de-pie'] },
    { name: 'Torso', color: '#ffb04d', items: ['press-de-pecho-convergente', 'jalon-con-agarre-estrecho', 'press-de-pecho-inclinado', 'remo-unilateral-en-maquina', 'press-de-hombros', 'curl-de-biceps-en-maquina', 'extension-de-triceps-sentado'] },
    { name: 'Glúteo y femoral', color: '#c792ea', items: ['maquina-de-hip-thrust', 'prensa-con-enfasis-en-gluteos', 'peso-muerto-en-smith', 'patada-de-gluteo-en-maquina', 'maquina-de-abductores', 'curl-femoral-de-pie'] },
    { name: 'Full body en máquinas', color: '#56c8f5', items: ['prensa-de-piernas', 'press-de-pecho-sentado', 'jalon-al-pecho', 'press-de-hombros', 'curl-femoral-sentado', 'maquina-de-abdominales', 'bicicleta-estatica'] }
  ];

  return { MUSCLES, EQUIP, GROUPS, GROUP_ICON, EXERCISES, TEMPLATES, SUBGROUPS, slug };
})();
