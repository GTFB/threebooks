import re
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from markdown_it import MarkdownIt

def clean_latex(text):
    """Clean common LaTeX notations into readable unicode for Word docx."""
    # Handle fractions
    text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1 / \2)', text)
    # Handle \mathbf{...}
    text = re.sub(r'\\mathbf\{([^}]+)\}', r'\1', text)
    # Handle \text{...}
    text = re.sub(r'\\text\{([^}]+)\}', r'\1', text)
    # Greek letters and symbols
    replacements = [
        (r'\\alpha\\mu\\alpha\\rho\\tau\\iota\\alpha', 'ἁμαρτία'),
        (r'\\rightarrow', '→'),
        (r'\\longrightarrow', '⟶'),
        (r'\\leftrightarrow', '↔'),
        (r'\\Longleftrightarrow', '⟺'),
        (r'\\Longrightarrow', '⟹'),
        (r'\\times', '×'),
        (r'\\le', '≤'),
        (r'\\ge', '≥'),
        (r'\\Delta', 'Δ'),
        (r'\\langle', '⟨'),
        (r'\\rangle', '⟩'),
        (r'\\circ', '°'),
        (r'\\begin\{array\}\{[^}]+\}', ''),
        (r'\\end\{array\}', ''),
        (r'\\begin\{pmatrix\}', '('),
        (r'\\end\{pmatrix\}', ')'),
        (r'\\cdots', '…'),
        (r'\\\\', '\n'),
        (r'\$', ''),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
    return text

def set_cell_background(cell, fill_hex):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D0D7DE", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def add_inline_runs(paragraph, tokens, base_color=None, base_italic=False, base_size=Pt(10.5)):
    """Render inline markdown tokens into Word paragraph runs."""
    bold = False
    italic = base_italic
    link_href = None
    
    for t in tokens:
        if t.type == 'strong_open':
            bold = True
        elif t.type == 'strong_close':
            bold = False
        elif t.type == 'em_open':
            italic = True
        elif t.type == 'em_close':
            italic = base_italic
        elif t.type == 'code_inline':
            run = paragraph.add_run(t.content)
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(160, 20, 50)
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F3F4F6"/>')
            run._r.get_or_add_rPr().append(shd)
        elif t.type == 'link_open':
            link_href = t.attrs.get('href', '')
        elif t.type == 'link_close':
            link_href = None
        elif t.type == 'softbreak':
            paragraph.add_run(' ')
        elif t.type == 'hardbreak':
            paragraph.add_run('\n')
        elif t.type == 'text':
            content = clean_latex(t.content)
            run = paragraph.add_run(content)
            run.bold = bold
            run.italic = italic
            run.font.size = base_size
            if link_href:
                run.font.color.rgb = RGBColor(9, 105, 218)
                run.underline = True
            elif base_color:
                run.font.color.rgb = base_color

def convert_markdown_to_docx(md_path, docx_path):
    doc = Document()
    
    # Page setup: A4, 2 cm margins
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(0.79)
        section.bottom_margin = Inches(0.79)
        section.left_margin = Inches(0.79)
        section.right_margin = Inches(0.79)
    
    # Configure base styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(34, 34, 34)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(4)
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()
        
    md = MarkdownIt('gfm-like', {'linkify': False})
    tokens = md.parse(md_text)
    
    i = 0
    n = len(tokens)
    
    # Tracking list nesting & numbering
    list_stack = [] # stack of ('ordered'|'bullet', index)
    in_blockquote = False
    
    while i < n:
        token = tokens[i]
        
        # HEADINGS
        if token.type == 'heading_open':
            level = int(token.tag[1]) # h1 -> 1, h2 -> 2, etc.
            i += 1
            inline_token = tokens[i]
            
            # Map levels to sizes and colors
            heading_cfg = {
                1: {'size': Pt(18), 'color': RGBColor(26, 54, 93), 'before': Pt(18), 'after': Pt(6), 'bold': True},
                2: {'size': Pt(14), 'color': RGBColor(43, 108, 176), 'before': Pt(14), 'after': Pt(4), 'bold': True},
                3: {'size': Pt(12), 'color': RGBColor(31, 78, 121), 'before': Pt(10), 'after': Pt(3), 'bold': True},
                4: {'size': Pt(11), 'color': RGBColor(45, 55, 72), 'before': Pt(8), 'after': Pt(2), 'bold': True},
                5: {'size': Pt(10.5), 'color': RGBColor(74, 85, 104), 'before': Pt(6), 'after': Pt(2), 'bold': True, 'italic': True},
            }
            cfg = heading_cfg.get(level, heading_cfg[5])
            
            p = doc.add_paragraph()
            p.paragraph_format.space_before = cfg['before']
            p.paragraph_format.space_after = cfg['after']
            p.paragraph_format.keep_with_next = True
            
            # If level 1 and first heading, treat as title
            add_inline_runs(p, inline_token.children or [], base_color=cfg['color'], base_italic=cfg.get('italic', False), base_size=cfg['size'])
            for r in p.runs:
                r.bold = cfg['bold']
                r.font.size = cfg['size']
            
            i += 1 # skip heading_close
            
        # HORIZONTAL RULE
        elif token.type == 'hr':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            p_border = parse_xml(f'''
                <w:pBdr {nsdecls("w")}>
                    <w:bottom w:val="single" w:sz="8" w:space="1" w:color="CBD5E0"/>
                </w:pBdr>
            ''')
            p._p.get_or_add_pPr().append(p_border)
            
        # BLOCKQUOTE
        elif token.type == 'blockquote_open':
            in_blockquote = True
        elif token.type == 'blockquote_close':
            in_blockquote = False
            
        # LISTS
        elif token.type == 'bullet_list_open':
            list_stack.append(('bullet', 0))
        elif token.type == 'bullet_list_close':
            if list_stack:
                list_stack.pop()
        elif token.type == 'ordered_list_open':
            start = token.attrs.get('start', 1)
            list_stack.append(('ordered', int(start)))
        elif token.type == 'ordered_list_close':
            if list_stack:
                list_stack.pop()
                
        elif token.type == 'list_item_open':
            # Next will be paragraph or inline
            pass
        elif token.type == 'list_item_close':
            pass
            
        # FENCE (CODE BLOCK / ASCII DIAGRAM)
        elif token.type == 'fence':
            content = token.content.rstrip('\n')
            # Render fence in a styled single-cell table
            table = doc.add_table(rows=1, cols=1)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            table.autofit = False
            cell = table.cell(0, 0)
            cell.width = Inches(6.69)
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
            set_table_borders(table, color="D0D7DE", sz="6", val="single")
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            
            run = p.add_run(content)
            run.font.name = 'Consolas'
            run.font.size = Pt(8.5)
            run.font.color.rgb = RGBColor(36, 41, 47)
            
            # Add small spacing after table
            spacer = doc.add_paragraph()
            spacer.paragraph_format.space_before = Pt(0)
            spacer.paragraph_format.space_after = Pt(4)
            
        # TABLES
        elif token.type == 'table_open':
            # Collect entire table structure
            table_tokens = []
            while i < n and tokens[i].type != 'table_close':
                table_tokens.append(tokens[i])
                i += 1
            table_tokens.append(tokens[i]) # table_close
            
            # Parse table rows and cells
            headers = []
            rows = []
            current_row = []
            is_header = False
            
            for t in table_tokens:
                if t.type == 'thead_open':
                    is_header = True
                elif t.type == 'thead_close':
                    is_header = False
                elif t.type == 'tr_open':
                    current_row = []
                elif t.type == 'tr_close':
                    if is_header:
                        headers.append(current_row)
                    else:
                        rows.append(current_row)
                elif t.type in ('th_open', 'td_open'):
                    pass
                elif t.type in ('th_close', 'td_close'):
                    pass
                elif t.type == 'inline':
                    current_row.append(t)
            
            all_rows = headers + rows
            if all_rows:
                num_cols = max(len(r) for r in all_rows)
                num_rows = len(all_rows)
                
                table = doc.add_table(rows=num_rows, cols=num_cols)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                set_table_borders(table, color="CBD5E0", sz="4", val="single")
                
                # Header row styling
                for r_idx, row_data in enumerate(all_rows):
                    tr = table.rows[r_idx]._tr
                    trPr = tr.get_or_add_trPr()
                    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
                    
                    is_this_hdr = r_idx < len(headers)
                    if is_this_hdr:
                        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
                    
                    for c_idx, cell_token in enumerate(row_data):
                        if c_idx >= num_cols:
                            continue
                        cell = table.cell(r_idx, c_idx)
                        set_cell_margins(cell, top=90, bottom=90, left=130, right=130)
                        
                        p = cell.paragraphs[0]
                        p.paragraph_format.space_before = Pt(1)
                        p.paragraph_format.space_after = Pt(1)
                        p.paragraph_format.line_spacing = 1.1
                        
                        if is_this_hdr:
                            set_cell_background(cell, "2B6CB0")
                            add_inline_runs(p, cell_token.children or [], base_color=RGBColor(255, 255, 255), base_size=Pt(9.5))
                            for run in p.runs:
                                run.bold = True
                        else:
                            bg_color = "F8FAFC" if (r_idx % 2 == 0) else "FFFFFF"
                            set_cell_background(cell, bg_color)
                            add_inline_runs(p, cell_token.children or [], base_size=Pt(9.0))
                            
                # Small spacer after table
                spacer = doc.add_paragraph()
                spacer.paragraph_format.space_before = Pt(0)
                spacer.paragraph_format.space_after = Pt(4)
                
        # PARAGRAPHS
        elif token.type == 'paragraph_open':
            i += 1
            inline_token = tokens[i]
            
            p = doc.add_paragraph()
            
            # Check if this paragraph is inside a list
            if list_stack:
                list_type, list_val = list_stack[-1]
                nesting = len(list_stack)
                indent_pt = 18 * nesting
                p.paragraph_format.left_indent = Pt(indent_pt)
                p.paragraph_format.space_before = Pt(1)
                p.paragraph_format.space_after = Pt(2.5)
                p.paragraph_format.line_spacing = 1.15
                
                # Prepend list marker
                if list_type == 'ordered':
                    marker = f"{list_val}. "
                    list_stack[-1] = (list_type, list_val + 1)
                else:
                    marker = "• "
                
                m_run = p.add_run(marker)
                m_run.bold = True
                m_run.font.color.rgb = RGBColor(43, 108, 176) if list_type == 'ordered' else RGBColor(74, 85, 104)
                
                add_inline_runs(p, inline_token.children or [], base_size=Pt(10))
            elif in_blockquote:
                p.paragraph_format.left_indent = Pt(24)
                p.paragraph_format.space_before = Pt(3)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.15
                
                # Left border for blockquote
                p_border = parse_xml(f'''
                    <w:pBdr {nsdecls("w")}>
                        <w:left w:val="single" w:sz="18" w:space="8" w:color="3182CE"/>
                    </w:pBdr>
                ''')
                p._p.get_or_add_pPr().append(p_border)
                add_inline_runs(p, inline_token.children or [], base_color=RGBColor(45, 55, 72), base_italic=True, base_size=Pt(10))
            else:
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.15
                add_inline_runs(p, inline_token.children or [], base_size=Pt(10.5))
                
            i += 1 # skip paragraph_close
            
        i += 1
        
    doc.save(docx_path)
    print(f"Successfully generated: {docx_path}")

if __name__ == "__main__":
    md_file = "synopsis_v12.md"
    docx_file = "synopsis_v12.docx"
    convert_markdown_to_docx(md_file, docx_file)
