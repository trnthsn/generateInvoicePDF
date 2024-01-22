from flask import Flask, request, make_response, render_template, send_file
from weasyprint import HTML, CSS
from xhtml2pdf import pisa
import io
from ironpdf import *

app = Flask(__name__)


def generate_invoice_content(ledgers):
    res = ''
    for ledger in ledgers:
        code = ledger['code']
        name = ledger['name']
        res = res + f'''
        <tr>
            <td colspan="6" style="font-weight: bold">
                {code} - {name} 
            </td>
        </tr>''' + '\n'
        allocations = ledger['cost_allocations']
        allocations_table = generate_allocations_table(allocations)
        res = res + allocations_table + '\n'

    return res


def generate_allocations_table(allocations):
    res = ''
    for allocation in allocations:
        res = res + f'''
        <tr>
            <td align="left">{allocation['invoice_date']}</td>
            <td align="left">{allocation['invoice_number']}</td>
            <td align="left">{allocation['supplier_name']}</td>
            <td align="left">{allocation['description']}</td>
            <td align="right">&euro;{allocation['vat_amount']}</td>
            <td align="right">&euro;{allocation['total']}</td>
        </tr>
        '''
    return res


def create_pdf(html_content):
    # Create a PDF buffer using xhtml2pdf
    buffer = io.BytesIO()
    pisa.CreatePDF(io.StringIO(html_content), dest=buffer)

    return buffer.getvalue()


@app.route('/generate_invoice', methods=['POST'])
def generate_invoice():
    # Retrieve data from the request
    data = request.get_json()

    building = data["building"]

    building_name = building['name']
    company_number = building['company_number']
    address_line_1 = building['address_line_1']
    address_line_2 = building['address_line_2']
    date_start = building['date_start']
    date_end = building['date_end']
    sum_total_amount = building['sum_total_amount']
    sum_vat_amount = building['sum_vat_amount']
    export_date = building['export_date']
    # current_page = building['current_date']
    # total_page = building['total_date']

    ledgers = building['ledgers']
    content = generate_invoice_content(ledgers)

    html_content = f'''
        <div style="margin: auto; width: 595px; height: 842px;">
        <div style="display: flex; display: -webkit-flex; flex-direction: column; height: 100%; width: 100%; margin: 24px; line-height: 16px; word-wrap: break-word; font-size: 11px; font-family: Inter; justify-content: space-between; webkit-justify-content: space-between; webkit-box-pack: justify; -ms-flex-pack: justify">
            <div>
                <div style="display: -webkit-box; display: -webkit-flex;">
                    <div style="width: 33%" align="left">
                        <p style="font-weight: bold; margin: 4px 0">{building_name}</p>
                        <p style="margin: 4px 0">{company_number}</p>
                        <p style="margin: 4px 0">{address_line_1}</p>
                        <p style="margin: 4px 0">{address_line_2}</p>
                    </div>
                    <div style="width: 33%" align="center">
                        <p style="font-weight: bold;">Facturenlijst - grootboekrekening</p>
                        <p>{date_start} - {date_end}</p>
                    </div>
                    <div style="width: 33%" align="right">
                        <p style="font-weight: bold;">{export_date}</p>
                    </div>
                </div>
                <div>
                    <table style="width: 100%; margin-top: 16px; border: 0; border-spacing: 0px 8px; line-height: 16px; word-wrap: break-word; font-size: 11px; font-family: Inter;">
                        <!--column header-->
                        <tr>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); padding-right: 8px; font-weight: bold;" align="left">Datum</td>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); padding-right: 8px; font-weight: bold;" align="left">Factuurnr.</td>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); padding-right: 8px; font-weight: bold;" align="left">Leverancier.</td>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); padding-right: 8px; font-weight: bold;" align="left">Omschrijving</td>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); width: 72px; padding-right: 8px; font-weight: bold;" align="right">BTW</td>
                            <td style="border-bottom: 1px solid rgba(0, 0, 0, 0.10); width: 72px; padding-left: 4px; font-weight: bold;" align="right">Total</td>
                        </tr>
                        {content}
                    </table>
                </div>
            </div>
            <div>
                <table style="width: 100%; margin-top: 16px; border: 0; border-spacing: 0px 8px; line-height: 16px; word-wrap: break-word; font-size: 11px; font-family: Inter;">
                    <!--footer-->
                    <tr>
                        <td style="border-top: 1px solid rgba(0, 0, 0, 0.10); padding-right: 8px; font-weight: bold;" align="left">Total</td>
                        <td style="border-top: 1px solid rgba(0, 0, 0, 0.10); width: 72px; padding-right: 8px; font-weight: bold;" align="right">&euro;{sum_vat_amount}</td>
                        <td style="border-top: 1px solid rgba(0, 0, 0, 0.10); width: 72px; padding-left: 4px; font-weight: bold;" align="right">&euro;{sum_total_amount}</td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
        '''

    # html_file = open("result.html", "w")
    # html_file.write(html_content)
    # html_file.close()
    #
    # HTML(filename="result.html").write_pdf("abc.pdf")

    renderer = ChromePdfRenderer()

    return html_content

if __name__ == '__main__':
    app.run()
