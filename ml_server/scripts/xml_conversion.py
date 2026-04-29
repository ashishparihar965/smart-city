import os
import xml.etree.ElementTree as ET

# paths
xml_folder = "Annotations/Annotations"
image_folder = "Indian_Number_Plates/Sample_Images"
output_folder = "labels"

os.makedirs(output_folder, exist_ok=True)

def convert(size, box):
    w, h = size
    xmin, xmax, ymin, ymax = box

    x_center = (xmin + xmax) / 2.0 / w
    y_center = (ymin + ymax) / 2.0 / h
    width = (xmax - xmin) / w
    height = (ymax - ymin) / h

    return (x_center, y_center, width, height)

for xml_file in os.listdir(xml_folder):
    if not xml_file.endswith(".xml"):
        continue

    tree = ET.parse(os.path.join(xml_folder, xml_file))
    root = tree.getroot()

    size = root.find("size")
    w = int(size.find("width").text)
    h = int(size.find("height").text)

    txt_filename = xml_file.replace(".xml", ".txt")
    txt_path = os.path.join(output_folder, txt_filename)

    with open(txt_path, "w") as f:
        for obj in root.iter("object"):
            cls = obj.find("name").text

            # only one class
            class_id = 0  

            xmlbox = obj.find("bndbox")
            xmin = int(xmlbox.find("xmin").text)
            xmax = int(xmlbox.find("xmax").text)
            ymin = int(xmlbox.find("ymin").text)
            ymax = int(xmlbox.find("ymax").text)

            bb = convert((w, h), (xmin, xmax, ymin, ymax))
            f.write(f"{class_id} {' '.join(map(str, bb))}\n")

print("✅ Conversion done")