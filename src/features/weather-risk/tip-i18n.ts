/**
 * The risk engine emits short English advice lines. Translate them for the UI so a Greek or
 * Turkish farmer never sees English on the home screen. Unknown lines fall back to English.
 */
const TIPS: Record<string, { el: string; tr: string }> = {
  "Keep your normal checks.": { el: "Συνέχισε τους κανονικούς ελέγχους.", tr: "Normal kontrollerinize devam edin." },
  "Check your yellow traps every 2 days.": { el: "Έλεγχε τις κίτρινες παγίδες κάθε 2 μέρες.", tr: "Sarı tuzakları 2 günde bir kontrol edin." },
  "Pick up fallen olives.": { el: "Μάζεψε τις πεσμένες ελιές.", tr: "Yere düşen zeytinleri toplayın." },
  "Pick up fallen olives and look for stung fruit.": { el: "Μάζεψε τις πεσμένες ελιές και ψάξε για τσιμπημένους καρπούς.", tr: "Düşen zeytinleri toplayın ve sokulmuş meyveye bakın." },
  "Think about harvesting earlier.": { el: "Σκέψου να μαζέψεις νωρίτερα.", tr: "Hasadı öne almayı düşünün." },
  "Ask a licensed agronomist about control.": { el: "Ρώτα αδειούχο γεωπόνο για την αντιμετώπιση.", tr: "Mücadele için lisanslı bir ziraat mühendisine danışın." },
  "Look at flowers and young fruit for tiny larvae.": { el: "Κοίτα άνθη και νεαρούς καρπούς για μικρές προνύμφες.", tr: "Çiçeklerde ve genç meyvelerde küçük larvalara bakın." },
  "Remove damaged leaves or fruit.": { el: "Αφαίρεσε χαλασμένα φύλλα ή καρπούς.", tr: "Zarar görmüş yaprak veya meyveleri ayıklayın." },
  "Ask a licensed agronomist about the right time to act.": { el: "Ρώτα αδειούχο γεωπόνο για τη σωστή στιγμή επέμβασης.", tr: "Doğru müdahale zamanı için lisanslı bir ziraat mühendisine danışın." },
  "No action needed.": { el: "Δεν χρειάζεται κάτι.", tr: "Bir şey yapmanıza gerek yok." },
  "Wash the olives before delivery.": { el: "Πλύνε τις ελιές πριν την παράδοση.", tr: "Teslimattan önce zeytinleri yıkayın." },
  "Order a lab test.": { el: "Ζήτα εργαστηριακό έλεγχο.", tr: "Laboratuvar testi isteyin." },
  "Keep harvested olives covered until delivery.": { el: "Κράτα τις μαζεμένες ελιές σκεπασμένες μέχρι την παράδοση.", tr: "Toplanan zeytinleri teslimata kadar örtülü tutun." },
  "Remove rotten or shrivelled olives from the trees.": { el: "Αφαίρεσε σάπιες ή ζαρωμένες ελιές από τα δέντρα.", tr: "Ağaçlardaki çürük veya buruşmuş zeytinleri ayıklayın." },
  "Do not leave harvested olives wet.": { el: "Μην αφήνεις τις μαζεμένες ελιές βρεγμένες.", tr: "Toplanan zeytinleri ıslak bırakmayın." },
  "Think about harvesting earlier, before more wet weather.": { el: "Σκέψου να μαζέψεις νωρίτερα, πριν από νέα υγρασία.", tr: "Daha fazla yağıştan önce hasadı öne almayı düşünün." },
  "Remove rotten or shrivelled olives.": { el: "Αφαίρεσε σάπιες ή ζαρωμένες ελιές.", tr: "Çürük veya buruşmuş zeytinleri ayıklayın." },
  "Ask a licensed agronomist if many fruits rot.": { el: "Ρώτα αδειούχο γεωπόνο αν σαπίζουν πολλοί καρποί.", tr: "Çok meyve çürüyorsa lisanslı bir ziraat mühendisine danışın." },
  "Do not prune before rain or frost.": { el: "Μην κλαδεύεις πριν από βροχή ή παγετό.", tr: "Yağmur veya dondan önce budama yapmayın." },
  "Clean your pruning tools between trees.": { el: "Καθάριζε τα εργαλεία κλαδέματος από δέντρο σε δέντρο.", tr: "Budama aletlerinizi ağaçlar arasında temizleyin." },
  "Look at fresh cuts for rough galls.": { el: "Κοίτα τις φρέσκες τομές για εξογκώματα (καρκίνωση).", tr: "Taze kesiklerde ur oluşumuna bakın." },
  "Ask a licensed agronomist about protecting wounds.": { el: "Ρώτα αδειούχο γεωπόνο για την προστασία των πληγών.", tr: "Yaraların korunması için lisanslı bir ziraat mühendisine danışın." },
  "Do not prune before the cold night.": { el: "Μην κλαδεύεις πριν από την κρύα νύχτα.", tr: "Soğuk geceden önce budama yapmayın." },
  "Check young shoots after the cold.": { el: "Έλεγξε τους νεαρούς βλαστούς μετά το κρύο.", tr: "Soğuktan sonra genç sürgünleri kontrol edin." },
  "Harvest ripe olives before the frost if you can.": { el: "Αν μπορείς, μάζεψε τις ώριμες ελιές πριν τον παγετό.", tr: "Mümkünse olgun zeytinleri dondan önce toplayın." },
  "Check young shoots and fruit after the frost.": { el: "Έλεγξε βλαστούς και καρπούς μετά τον παγετό.", tr: "Dondan sonra sürgün ve meyveleri kontrol edin." },
  "Water young trees early in the morning if you can.": { el: "Αν μπορείς, πότισε τα νεαρά δέντρα νωρίς το πρωί.", tr: "Mümkünse genç ağaçları sabah erken sulayın." },
  "Avoid pruning and heavy work in the hottest hours.": { el: "Απόφυγε κλάδεμα και βαριές δουλειές τις πιο ζεστές ώρες.", tr: "En sıcak saatlerde budama ve ağır işten kaçının." },
  "Keep harvested olives in the shade.": { el: "Κράτα τις μαζεμένες ελιές στη σκιά.", tr: "Toplanan zeytinleri gölgede tutun." },
  "Pick up broken branches after the wind.": { el: "Μάζεψε τα σπασμένα κλαδιά μετά τον αέρα.", tr: "Rüzgârdan sonra kırık dalları toplayın." },
  "Harvest ripe olives before the wind if you can.": { el: "Αν μπορείς, μάζεψε τις ώριμες ελιές πριν τον αέρα.", tr: "Mümkünse olgun zeytinleri rüzgârdan önce toplayın." },
  "Check the trees for broken branches and wounds afterwards.": { el: "Μετά, έλεγξε τα δέντρα για σπασμένα κλαδιά και πληγές.", tr: "Sonrasında ağaçlarda kırık dal ve yara olup olmadığına bakın." },
  "Water young trees if you can.": { el: "Αν μπορείς, πότισε τα νεαρά δέντρα.", tr: "Mümkünse genç ağaçları sulayın." },
  "Spread mulch around the trunks.": { el: "Βάλε εδαφοκάλυψη γύρω από τους κορμούς.", tr: "Gövdelerin çevresine malç serin." },
  "Avoid heavy pruning until it rains.": { el: "Απόφυγε το αυστηρό κλάδεμα μέχρι να βρέξει.", tr: "Yağmur yağana kadar sert budamadan kaçının." },
  "Check the leaves for round spots after the next rain.": { el: "Μετά την επόμενη βροχή, έλεγξε τα φύλλα για στρογγυλές κηλίδες.", tr: "Bir sonraki yağmurdan sonra yapraklarda yuvarlak lekelere bakın." },
  "Prune for airflow so the leaves dry faster.": { el: "Κλάδεψε για αερισμό ώστε τα φύλλα να στεγνώνουν πιο γρήγορα.", tr: "Yapraklar daha hızlı kurusun diye havalanma için budayın." },
  "Check the leaves for round spots now, especially after rain.": { el: "Έλεγξε τώρα τα φύλλα για στρογγυλές κηλίδες, ειδικά μετά από βροχή.", tr: "Özellikle yağmurdan sonra yapraklarda yuvarlak lekelere şimdi bakın." },
  "Prune for airflow and remove fallen leaves.": { el: "Κλάδεψε για αερισμό και μάζεψε τα πεσμένα φύλλα.", tr: "Havalanma için budayın ve düşen yaprakları toplayın." },
  "Ask a licensed agronomist if you see spots on many trees.": { el: "Ρώτα αδειούχο γεωπόνο αν δεις κηλίδες σε πολλά δέντρα.", tr: "Birçok ağaçta leke görürseniz lisanslı bir ziraat mühendisine danışın." },
};

export function localizeTip(text: string, locale: string): string {
  if (!text) return text;
  const hit = TIPS[text.trim()];
  if (!hit) return text;
  if (locale.startsWith("el")) return hit.el;
  if (locale.startsWith("tr")) return hit.tr;
  return text;
}

export const KNOWN_TIPS = Object.keys(TIPS);
