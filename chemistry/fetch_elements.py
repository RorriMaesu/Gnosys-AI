import urllib.request
import json
import os

def clean_cat(cat, group=None):
    cat = cat.lower()
    if group == 17: return "halogen"
    if "noble gas" in cat: return "noble-gas"
    if "alkali metal" in cat: return "alkali-metal"
    if "alkaline earth metal" in cat: return "alkaline-earth-metal"
    if "halogen" in cat: return "halogen"
    if "metalloid" in cat: return "metalloid"
    if "post-transition metal" in cat or (group == 13 and "transition metal" in cat): return "post-transition-metal"
    if "transition metal" in cat: return "transition-metal"
    if "lanthanide" in cat: return "lanthanide"
    if "actinide" in cat: return "actinide"
    if "nonmetal" in cat: return "nonmetal"
    return "nonmetal"


# Standard atomic radii lookup (empirical or covalent in pm)
# Elements 1 to 118
ATOMIC_RADII = {
    1: 53, 2: 31, 3: 167, 4: 112, 5: 87, 6: 67, 7: 56, 8: 48, 9: 42, 10: 38,
    11: 190, 12: 145, 13: 118, 14: 111, 15: 98, 16: 87, 17: 79, 18: 71,
    19: 243, 20: 194, 21: 184, 22: 176, 23: 171, 24: 166, 25: 161, 26: 156,
    27: 152, 28: 149, 29: 145, 30: 142, 31: 136, 32: 125, 33: 114, 34: 103,
    35: 94, 36: 87, 37: 265, 38: 219, 39: 212, 40: 206, 41: 198, 42: 190,
    43: 183, 44: 178, 45: 173, 46: 169, 47: 165, 48: 161, 49: 156, 50: 145,
    51: 133, 52: 123, 53: 115, 54: 108, 55: 298, 56: 253, 57: 226, 58: 210,
    59: 247, 60: 206, 61: 205, 62: 238, 63: 231, 64: 233, 65: 225, 66: 228,
    67: 226, 68: 226, 69: 222, 70: 222, 71: 217, 72: 208, 73: 200, 74: 193,
    75: 188, 76: 185, 77: 180, 78: 177, 79: 174, 80: 171, 81: 156, 82: 154,
    83: 143, 84: 135, 85: 127, 86: 120, 87: 290, 88: 248, 89: 215, 90: 206,
    91: 200, 92: 196, 93: 190, 94: 187, 95: 180, 96: 169, 97: 166, 98: 168,
    99: 165, 100: 167, 101: 173, 102: 176, 103: 161, 104: 157, 105: 156,
    106: 143, 107: 135, 108: 127, 109: 121, 110: 122, 111: 121, 112: 122,
    113: 136, 114: 143, 115: 135, 116: 135, 117: 138, 118: 140
}

# Academic anomalies registry
ANOMALIES = {
    1: "Placed in Group 1 due to valence configuration, but exhibits chemical behavior distinct from alkali metals (gas, high ionization energy).",
    5: "First ionization energy is lower than Beryllium due to the electron occupying a higher energy 2p subshell, which is shielded by the 2s² core.",
    8: "First ionization energy is lower than Nitrogen due to electron-electron repulsion in the doubly occupied 2p orbital.",
    13: "First ionization energy is lower than Magnesium due to orbital shielding: the 3p electron is shielded by the filled 3s orbital.",
    16: "First ionization energy is lower than Phosphorus due to electron-electron pairing repulsion in the 3p orbital.",
    24: "Configuration is [Ar] 3d⁵ 4s¹ instead of [Ar] 3d⁴ 4s² because a half-filled d-subshell (d⁵) provides extra stability via exchange energy.",
    29: "Configuration is [Ar] 3d¹⁰ 4s¹ instead of [Ar] 3d⁹ 4s² because a fully filled d-subshell (d¹⁰) provides maximum quantum stability.",
    41: "Niobium has configuration [Kr] 4d⁴ 5s¹ due to electron-electron interactions and energy level crossings between d and s orbitals.",
    42: "Molybdenum has configuration [Kr] 4d⁵ 5s¹ to maximize d-subshell exchange energy stability (half-filled d).",
    44: "Ruthenium has configuration [Kr] 4d⁷ 5s¹ due to electronic correlation effects.",
    45: "Rhodium has configuration [Kr] 4d⁸ 5s¹ due to electron orbital interaction complexities.",
    46: "Palladium has configuration [Kr] 4d¹⁰ 5s⁰, completely filling its 4d shell and leaving its 5s orbital vacant due to relative orbital energies.",
    47: "Silver has configuration [Kr] 4d¹⁰ 5s¹ to achieve the highly stable, fully filled 4d shell configuration.",
    78: "Platinum has configuration [Xe] 4f¹⁴ 5d⁹ 6s¹ due to relativistic effects that lower the s-d separation energy.",
    79: "Gold has configuration [Xe] 4f¹⁴ 5d¹⁰ 6s¹ due to strong relativistic stabilization of the 5d shell and contraction of s shells."
}

def fetch_and_map():
    url = 'https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json'
    print("Fetching Periodic Table JSON...")
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        source_data = json.loads(response.read().decode())
        
    mapped_elements = []
    
    for el in source_data['elements']:
        num = el['number']
        
        # Calculate valence electrons
        valence = el['shells'][-1] if el['shells'] else 0
        
        # Get ionization energy base
        ie = el['ionization_energies'][0] if el['ionization_energies'] else None
        
        # Check anomaly
        anomaly_flag = num in ANOMALIES
        anomaly_desc = ANOMALIES.get(num, "")
        
        # Construct element record
        mapped_el = {
            "element": el['name'],
            "symbol": el['symbol'],
            "atomic_number": num,
            "atomic_mass": el['atomic_mass'],
            "group": el['group'],
            "period": el['period'],
            "grid_col": el['xpos'],
            "grid_row": el['ypos'],
            "category": clean_cat(el['category'], el['group']),
            "electron_config": el['electron_configuration_semantic'] or el['electron_configuration'],
            "valence_electrons": valence,
            "shells": el['shells'],
            "trends": {
                "electronegativity": el['electronegativity_pauling'],
                "ionization_energy_base": ie,
                "atomic_radius_pm": ATOMIC_RADII.get(num, None)
            },
            "academic_notes": {
                "anomaly_flag": anomaly_flag,
                "anomaly_description": anomaly_desc
            }
        }
        mapped_elements.append(mapped_el)
        
    # Write directly to data.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(script_dir, "periodic-table")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "data.json")
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(mapped_elements, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully processed all {len(mapped_elements)} elements and saved to {out_path}!")

if __name__ == "__main__":
    fetch_and_map()
