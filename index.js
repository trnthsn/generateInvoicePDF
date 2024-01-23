const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/generate_invoice', async (req, res) => {
  const { building } = req.body;

  // Generate HTML content for the invoice
  const html = generateInvoiceHTML(building);

  // Convert HTML to PDF using Puppeteer
  const buffer = await generatePDF(html);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
  res.send(buffer);
});

async function generatePDF(html) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html);
  
  const buffer = await page.pdf({
    format: 'A4',
    scale: 1.25,
    margin: {top: 25},
    displayHeaderFooter: true,
    preferCSSPageSize: true,
    footerTemplate: `
    <p style="margin: auto;font-size: 12px;">
      <span class="pageNumber"></span>
        /
      <span class="totalPages"></span>
    </p>
    `
  });

  await browser.close();

  return buffer;
}

function generateAllocationsTable(allocations) {
  let res = '';
  for (const allocation of allocations) {
    res += `
      <tr>
          <td align="left">${allocation.invoice_date}</td>
          <td align="left">${allocation.invoice_number}</td>
          <td align="left">${allocation.supplier_name}</td>
          <td align="left">${allocation.description}</td>
          <td align="right">&euro;${allocation.vat_amount}</td>
          <td align="right">&euro;${allocation.total}</td>
      </tr>
      `;
  }
  return res;
}

function generateInvoiceContent(ledgers) {
  let res = '';
  for (const ledger of ledgers) {
    const code = ledger.code;
    const name = ledger.name;

    res += `
      <tr>
          <td colspan="6" style="font-weight: bold">
              ${code} - ${name}
          </td>
      </tr>
      `;

    const allocations = ledger.cost_allocations;
    const allocationsTable = generateAllocationsTable(allocations);
    res += allocationsTable;
  }
  return res;
}

function generateInvoiceHTML(building) {
  const {
    name: building_name,
    company_number,
    address_line_1,
    address_line_2,
    date_start,
    date_end,
    sum_total_amount,
    sum_vat_amount,
    export_date,
    ledgers
  } = building

  const content = generateInvoiceContent(ledgers)

  const invoiceHTML = `
  <html>
  <style>
    @page:first {
      margin: 0;
    }
    #header,
    #footer {
      padding: 0 !important;
    }
    html,
    body,
    div,
    span,
    applet,
    object,
    iframe,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 100%;
    }
  </style>

  <body style="display: flex; justify-content: center; align-items: center">
    <div style="width: 595px; height: 842px" className='invoice'>
      <div
        style="
          display: flex;
          display: -webkit-flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          line-height: 16px;
          word-wrap: break-word;
          font-size: 11px;
          font-family: Inter;
          justify-content: space-between;
          -ms-flex-pack: justify;
        "
      >
        <div>
          <div style="display: -webkit-box; display: -webkit-flex">
            <div style="width: 33%" align="left">
              <p style="font-weight: bold; margin: 4px 0">${building_name}</p>
              <p style="margin: 4px 0">${company_number}</p>
              <p style="margin: 4px 0">${address_line_1}</p>
              <p style="margin: 4px 0">${address_line_2}</p>
            </div>
            <div style="width: 33%" align="center">
              <p style="font-weight: bold">Facturenlijst - grootboekrekening</p>
              <p>${date_start} - ${date_end}</p>
            </div>
            <div style="width: 33%" align="right">
              <p style="font-weight: bold">${export_date}</p>
            </div>
          </div>
          <div>
            <table
              style="
                width: 100%;
                margin-top: 16px;
                border: 0;
                border-spacing: 0px 8px;
                line-height: 16px;
                word-wrap: break-word;
                font-size: 11px;
                font-family: Inter;
              "
            >
              <!--column header-->
              <tr>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: bold;
                  "
                  align="left"
                >
                  Datum
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: bold;
                  "
                  align="left"
                >
                  Factuurnr.
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: bold;
                  "
                  align="left"
                >
                  Leverancier.
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: bold;
                  "
                  align="left"
                >
                  Omschrijving
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    width: 72px;
                    padding-right: 8px;
                    font-weight: bold;
                  "
                  align="right"
                >
                  BTW
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    width: 72px;
                    padding-left: 4px;
                    font-weight: bold;
                  "
                  align="right"
                >
                  Total
                </td>
              </tr>
              ${content}
            </table>
          </div>
        </div>
        <div>
          <table
            style="
              width: 100%;
              margin-top: 16px;
              border: 0;
              border-spacing: 0px 8px;
              line-height: 16px;
              word-wrap: break-word;
              font-size: 11px;
              font-family: Inter;
            "
          >
            <!--footer-->
            <tr>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  padding-right: 8px;
                  font-weight: bold;
                "
                align="left"
              >
                Total
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-right: 8px;
                  font-weight: bold;
                "
                align="right"
              >
                &euro;${sum_vat_amount}
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-left: 4px;
                  font-weight: bold;
                "
                align="right"
              >
                &euro;${sum_total_amount}
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>
    `;

  return invoiceHTML;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
