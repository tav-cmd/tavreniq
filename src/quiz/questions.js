// Authored, stable facts. First choice is the answer in source only; runtime shuffles all choices.
// Each category has ten unique questions, with explicitly assigned difficulty.
const groups = {
'General knowledge': [
['easy','How many days are in a leap year in the Gregorian calendar?','366','365','364','360'],
['easy','Which instrument measures temperature?','Thermometer','Barometer','Odometer','Compass'],
['easy','Which language is primarily spoken in Brazil?','Portuguese','Spanish','French','Italian'],
['easy','How many sides does a hexagon have?','6','5','7','8'],
['medium','What does the Roman numeral L represent?','50','100','500','10'],
['medium','Which metal has the chemical symbol Au?','Gold','Silver','Aluminium','Copper'],
['medium','Which device measures atmospheric pressure?','Barometer','Thermometer','Speedometer','Ammeter'],
['medium','How many years make up a millennium?','1,000','100','10','10,000'],
['hard','Which writing system uses raised dots read by touch?','Braille','Morse code','Cuneiform','Semaphore'],
['hard','What is the SI unit of luminous intensity?','Candela','Lux','Lumen','Watt']
],
'Space': [
['easy','Which planet is known as the Red Planet?','Mars','Venus','Jupiter','Mercury'],
['easy','Which star is closest to Earth?','The Sun','Sirius','Polaris','Proxima Centauri'],
['easy','What is Earth’s natural satellite called?','The Moon','Titan','Europa','Phobos'],
['easy','Which planet is the largest in our Solar System?','Jupiter','Saturn','Neptune','Earth'],
['medium','Which planet is closest to the Sun?','Mercury','Venus','Earth','Mars'],
['medium','Which galaxy contains our Solar System?','Milky Way','Andromeda','Triangulum','Whirlpool'],
['medium','Who was the first person to walk on the Moon?','Neil Armstrong','Buzz Aldrin','Yuri Gagarin','Michael Collins'],
['medium','Which planet has the Great Red Spot?','Jupiter','Mars','Saturn','Uranus'],
['hard','Which moon is the largest natural satellite of Saturn?','Titan','Europa','Ganymede','Triton'],
['hard','What is the name of the boundary beyond which light cannot escape a black hole?','Event horizon','Asteroid belt','Photosphere','Magnetopause']
],
'Biology': [
['easy','Which organ pumps blood around the human body?','Heart','Liver','Lung','Kidney'],
['easy','What process lets plants use sunlight to make sugars?','Photosynthesis','Fermentation','Digestion','Evaporation'],
['easy','Which gas do humans need for aerobic respiration?','Oxygen','Helium','Neon','Argon'],
['easy','Which group of animals has feathers?','Birds','Mammals','Reptiles','Amphibians'],
['medium','What molecule carries most hereditary information in human cells?','DNA','Starch','Cellulose','Chlorophyll'],
['medium','Which organelle is the main site of photosynthesis in plant cells?','Chloroplast','Ribosome','Lysosome','Nucleus'],
['medium','Which blood cells primarily carry oxygen?','Red blood cells','Platelets','White blood cells','Stem cells'],
['medium','What is the largest organ of the human body by surface area?','Skin','Liver','Heart','Brain'],
['hard','What is the basic structural and functional unit of a kidney?','Nephron','Neuron','Alveolus','Villus'],
['hard','Which organelle assembles proteins from amino acids?','Ribosome','Golgi apparatus','Lysosome','Centriole']
],
'Physics and chemistry': [
['easy','What is the chemical formula of water?','H2O','CO2','O2','NaCl'],
['easy','Which force keeps planets in orbit around the Sun?','Gravity','Friction','Buoyancy','Surface tension'],
['easy','At standard atmospheric pressure, at what Celsius temperature does pure water freeze?','0°C','10°C','50°C','100°C'],
['easy','Which state of matter has a fixed volume but takes the shape of its container?','Liquid','Gas','Plasma','Solid'],
['medium','What is the chemical symbol for sodium?','Na','S','So','N'],
['medium','Which subatomic particle has a negative electric charge?','Electron','Proton','Neutron','Alpha particle'],
['medium','What is the SI unit of electrical resistance?','Ohm','Volt','Ampere','Coulomb'],
['medium','What is the atomic number of carbon?','6','8','12','14'],
['hard','Which law states that pressure is inversely proportional to volume for a fixed amount of gas at constant temperature?','Boyle’s law','Ohm’s law','Hooke’s law','Faraday’s law'],
['hard','What is the SI unit of capacitance?','Farad','Henry','Tesla','Weber']
],
'Technology': [
['easy','What does CPU stand for?','Central Processing Unit','Computer Power Utility','Central Program Upload','Control Processing User'],
['easy','Which digits are used in the binary number system?','0 and 1','1 and 2','0 through 7','0 through 9'],
['easy','Which device routes data packets between computer networks?','Router','Keyboard','Monitor','Scanner'],
['easy','What does USB stand for?','Universal Serial Bus','Unified System Backup','Universal Signal Board','User Storage Base'],
['medium','What does HTML stand for?','HyperText Markup Language','High Transfer Machine Language','Hyperlink Text Management Logic','Home Tool Markup Language'],
['medium','Which protocol encrypts standard web traffic when used in HTTPS?','TLS','FTP','ARP','ICMP'],
['medium','How many bits are in one byte in modern computing?','8','4','16','32'],
['medium','What does DNS primarily translate domain names into?','IP addresses','Passwords','Screen resolutions','File sizes'],
['hard','Which data structure follows last-in, first-out order?','Stack','Queue','Set','Graph'],
['hard','What is the time complexity of binary search on a sorted random-access array?','O(log n)','O(n)','O(n squared)','O(2 to the n)']
],
'History': [
['easy','Which ancient civilization built the pyramids at Giza?','Ancient Egyptians','Ancient Romans','Incas','Aztecs'],
['easy','In which year did World War II end?','1945','1918','1939','1963'],
['easy','Who became South Africa’s first Black president in 1994?','Nelson Mandela','Desmond Tutu','Thabo Mbeki','Steve Biko'],
['easy','Which wall in Germany fell in 1989?','Berlin Wall','Hadrian’s Wall','Great Wall','Antonine Wall'],
['medium','In which year did Nigeria gain independence from Britain?','1960','1957','1963','1970'],
['medium','Who was the first president of the United States?','George Washington','Abraham Lincoln','Thomas Jefferson','John Adams'],
['medium','Which civilization built Machu Picchu?','Inca','Maya','Aztec','Olmec'],
['medium','Which document was sealed by King John of England in 1215?','Magna Carta','Treaty of Versailles','Bill of Rights 1689','Domesday Book'],
['hard','In which year did the Battle of Hastings take place?','1066','1215','1415','1485'],
['hard','Which empire had Constantinople as its capital when the city fell in 1453?','Byzantine Empire','Mongol Empire','Western Roman Empire','Persian Achaemenid Empire']
],
'Geography': [
['easy','What is the capital of France?','Paris','Rome','Madrid','Berlin'],
['easy','Which ocean is the largest by surface area?','Pacific Ocean','Atlantic Ocean','Indian Ocean','Arctic Ocean'],
['easy','On which continent is Kenya?','Africa','Asia','Europe','South America'],
['easy','What is the capital of Japan?','Tokyo','Kyoto','Osaka','Seoul'],
['medium','Which country has Canberra as its capital?','Australia','New Zealand','Canada','Austria'],
['medium','Which mountain has the highest summit above sea level?','Mount Everest','K2','Kilimanjaro','Denali'],
['medium','Which country contains the city of Barcelona?','Spain','Portugal','Italy','France'],
['medium','What is the largest hot desert in the world?','Sahara','Gobi','Kalahari','Atacama'],
['hard','Which strait separates Spain from Morocco?','Strait of Gibraltar','Bering Strait','Strait of Hormuz','Strait of Malacca'],
['hard','Which country completely surrounds Lesotho?','South Africa','Botswana','Namibia','Zimbabwe']
],
'Mathematics': [
['easy','What is 12 multiplied by 8?','96','84','108','88'],
['easy','What is the square root of 81?','9','8','7','18'],
['easy','How many degrees are in a right angle?','90','45','180','360'],
['easy','What is 25 percent of 200?','50','25','75','100'],
['medium','What is the next prime number after 7?','11','9','10','12'],
['medium','What is the sum of the interior angles of a triangle in Euclidean geometry?','180°','90°','270°','360°'],
['medium','What is 2 raised to the fifth power?','32','10','16','64'],
['medium','What is the median of 2, 4, 9, 11, and 20?','9','4','11','8'],
['hard','What is the derivative of x squared with respect to x?','2x','x','x cubed','2'],
['hard','What is the value of 5 factorial?','120','25','60','100']
],
'Sports': [
['easy','How many players does one association football team normally have on the field at kickoff?','11','9','10','12'],
['easy','Which sport uses a shuttlecock?','Badminton','Tennis','Squash','Table tennis'],
['easy','In which sport is a slam dunk performed?','Basketball','Cricket','Rugby union','Baseball'],
['easy','How many rings are in the Olympic symbol?','5','4','6','7'],
['medium','Which country won the men’s FIFA World Cup in 2022?','Argentina','France','Croatia','Brazil'],
['medium','How many legal deliveries are in a standard over in cricket?','6','4','8','10'],
['medium','In tennis scoring, what word means zero points?','Love','Deuce','Advantage','Ace'],
['medium','Which swimming stroke is performed face-up?','Backstroke','Breaststroke','Butterfly','Front crawl'],
['hard','What is the official marathon race distance?','42.195 kilometres','40 kilometres','21.0975 kilometres','50 kilometres'],
['hard','In standard chess, which piece can jump over intervening pieces?','Knight','Bishop','Rook','Queen']
],
'Entertainment': [
['easy','Which fictional wizard has a lightning-shaped scar on his forehead?','Harry Potter','Gandalf','Merlin','Doctor Strange'],
['easy','Which film series features the character Darth Vader?','Star Wars','Star Trek','The Matrix','Jurassic Park'],
['easy','Which animated film features the song Let It Go?','Frozen','Moana','Tangled','Encanto'],
['easy','What is the name of the cowboy toy in Toy Story?','Woody','Buzz Lightyear','Rex','Sarge'],
['medium','Who directed the 1997 film Titanic?','James Cameron','Steven Spielberg','Christopher Nolan','Peter Jackson'],
['medium','Which fictional country is Black Panther’s home?','Wakanda','Zamunda','Genovia','Latveria'],
['medium','Which studio produced the animated film Spirited Away?','Studio Ghibli','Pixar','DreamWorks Animation','Illumination'],
['medium','Which character is the captain of the Black Pearl in Pirates of the Caribbean?','Jack Sparrow','Indiana Jones','James Hook','Han Solo'],
['hard','Who directed the film Seven Samurai?','Akira Kurosawa','Hayao Miyazaki','Yasujiro Ozu','Bong Joon-ho'],
['hard','Which film won Best Picture at the 2020 Academy Awards?','Parasite','1917','Joker','The Irishman']
],
'Gaming': [
['easy','Which company created the Mario video game franchise?','Nintendo','Sega','Sony','Valve'],
['easy','Which Minecraft creature is known for approaching players and exploding?','Creeper','Villager','Cow','Sheep'],
['easy','What is the name of Sonic the Hedgehog’s two-tailed fox friend?','Tails','Knuckles','Shadow','Silver'],
['easy','Which puzzle game uses falling tetrominoes?','Tetris','Sudoku','Minesweeper','Portal'],
['medium','What is the name of the main playable hero in most The Legend of Zelda games?','Link','Zelda','Ganondorf','Tingle'],
['medium','Which company developed the original Portal?','Valve','Bungie','Rockstar Games','Capcom'],
['medium','In the original Pokémon games, Pikachu is which type?','Electric','Water','Fire','Grass'],
['medium','Which game series features the character Master Chief?','Halo','Doom','Mass Effect','Gears of War'],
['hard','Who created the original Tetris in 1984?','Alexey Pajitnov','Shigeru Miyamoto','Hideo Kojima','Sid Meier'],
['hard','What is the fictional underwater city in the first BioShock?','Rapture','Columbia','Midgar','Night City']
],
'Literature': [
['easy','Who wrote Romeo and Juliet?','William Shakespeare','Charles Dickens','Jane Austen','Mark Twain'],
['easy','Which detective lives at 221B Baker Street in Arthur Conan Doyle’s stories?','Sherlock Holmes','Hercule Poirot','Miss Marple','Father Brown'],
['easy','Who wrote The Hobbit?','J. R. R. Tolkien','C. S. Lewis','J. K. Rowling','George Orwell'],
['easy','Which animal is the title character in The Very Hungry Caterpillar?','Caterpillar','Spider','Ant','Bee'],
['medium','Who wrote Things Fall Apart?','Chinua Achebe','Wole Soyinka','Ngũgĩ wa Thiong’o','Ben Okri'],
['medium','Who wrote Pride and Prejudice?','Jane Austen','Charlotte Brontë','Mary Shelley','Virginia Woolf'],
['medium','Who wrote the novel Nineteen Eighty-Four?','George Orwell','Aldous Huxley','Ray Bradbury','H. G. Wells'],
['medium','Which novel features the character Atticus Finch?','To Kill a Mockingbird','The Great Gatsby','Moby-Dick','Jane Eyre'],
['hard','Who wrote One Hundred Years of Solitude?','Gabriel García Márquez','Jorge Luis Borges','Pablo Neruda','Mario Vargas Llosa'],
['hard','Which Nigerian writer received the Nobel Prize in Literature in 1986?','Wole Soyinka','Chinua Achebe','Chimamanda Ngozi Adichie','Buchi Emecheta']
],
'Music and art': [
['easy','How many strings does a standard violin have?','4','5','6','8'],
['easy','Who painted the Mona Lisa?','Leonardo da Vinci','Michelangelo','Raphael','Vincent van Gogh'],
['easy','Which instrument has black and white keys and is commonly played with both hands?','Piano','Trumpet','Violin','Flute'],
['easy','Which musical symbol is used to raise a note by one semitone?','Sharp','Flat','Natural','Rest'],
['medium','Who painted The Starry Night in 1889?','Vincent van Gogh','Claude Monet','Pablo Picasso','Salvador Dalí'],
['medium','How many semitones are in an octave in standard twelve-tone equal temperament?','12','7','8','10'],
['medium','Which composer wrote the Moonlight Sonata?','Ludwig van Beethoven','Wolfgang Amadeus Mozart','Johann Sebastian Bach','Frédéric Chopin'],
['medium','What does a rest indicate in written music?','A period of silence','Play louder','Play faster','Repeat the note'],
['hard','Which artist painted Guernica?','Pablo Picasso','Henri Matisse','Paul Cézanne','Edvard Munch'],
['hard','What does the musical marking pianissimo mean?','Very softly','Very loudly','Gradually faster','Gradually slower']
],
'Earth and environment': [
['easy','What is molten rock called after it reaches Earth’s surface?','Lava','Magma','Granite','Basalt'],
['easy','Which gas makes up the largest proportion of Earth’s dry atmosphere?','Nitrogen','Oxygen','Carbon dioxide','Hydrogen'],
['easy','What is the process of liquid water changing into water vapour called?','Evaporation','Condensation','Freezing','Deposition'],
['easy','Which renewable energy source uses moving air?','Wind power','Geothermal power','Tidal power','Hydropower'],
['medium','Which layer of Earth lies between the crust and the core?','Mantle','Troposphere','Stratosphere','Ozone layer'],
['medium','What instrument records seismic waves?','Seismograph','Anemometer','Hygrometer','Altimeter'],
['medium','Which scale ranks minerals by scratch hardness?','Mohs scale','Richter scale','Beaufort scale','Celsius scale'],
['medium','Which type of rock forms when magma or lava cools and solidifies?','Igneous','Sedimentary','Metamorphic','Fossil'],
['hard','What is the most abundant mineral group in Earth’s crust?','Feldspars','Micas','Olivines','Pyroxenes'],
['hard','Which atmospheric layer contains most of Earth’s ozone layer?','Stratosphere','Troposphere','Mesosphere','Thermosphere']
],
'Food and everyday science': [
['easy','Which fruit is traditionally used to make guacamole?','Avocado','Mango','Banana','Pineapple'],
['easy','Which grain is typically seasoned with vinegar to make sushi?','Rice','Wheat','Barley','Maize'],
['easy','Which insects produce honey?','Honey bees','Ants','Termites','Dragonflies'],
['easy','Which kitchen appliance is designed to keep food frozen?','Freezer','Oven','Toaster','Dishwasher'],
['medium','Which vitamin is also called ascorbic acid?','Vitamin C','Vitamin A','Vitamin D','Vitamin K'],
['medium','Which microorganism commonly makes bread dough rise through fermentation?','Yeast','Amoeba','Algae','Virus'],
['medium','What is the main sugar naturally present in milk?','Lactose','Sucrose','Fructose','Maltose'],
['medium','Which substance gives chilli peppers their characteristic heat?','Capsaicin','Caffeine','Menthol','Citric acid'],
['hard','Which reaction is a major cause of browning when bread is toasted?','Maillard reaction','Saponification','Electrolysis','Neutralization'],
['hard','Which enzyme in human saliva begins the digestion of starch?','Amylase','Lipase','Pepsin','Lactase']
]
};
export const questions = Object.entries(groups).flatMap(([category, rows], group) =>
  rows.map(([difficulty, prompt, correct, ...wrong], index) => Object.freeze({
    id: `q${String(group * 10 + index + 1).padStart(3, '0')}`, category, difficulty,
    prompt, options: Object.freeze([correct, ...wrong]), answer: 0
  })));
Object.freeze(questions);
