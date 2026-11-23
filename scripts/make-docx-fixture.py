"""Regenerates tests/fixtures/sample.docx (requires: pip install python-docx).
Contains a heading, a bold run, an italic run, an underlined run, a bullet list and a numbered list."""
from docx import Document

d = Document()
d.add_heading("Quarterly Report", level=1)
p = d.add_paragraph("Normal text, ")
p.add_run("bold text").bold = True
p.add_run(", ")
p.add_run("italic text").italic = True
p.add_run(", ")
p.add_run("underlined text").underline = True
d.add_paragraph("bullet one", style="List Bullet")
d.add_paragraph("bullet two", style="List Bullet")
d.add_paragraph("step one", style="List Number")
d.add_paragraph("step two", style="List Number")
d.save("tests/fixtures/sample.docx")
