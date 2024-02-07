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
  const browser = await puppeteer.launch({ headless: 'new'});
  const page = await browser.newPage();
  await page.setContent(html)
  const buffer = await page.pdf({
    format: 'A4',
    margin: { top: 25, bottom: 40 },
    displayHeaderFooter: true,
    scale: 1.25,
    footerTemplate: `
    <p style="display:block; margin: auto; font-size: 10px; margin-top: 40px; font-family: 'Inter'">
      Pagina <span class="pageNumber"></span>
        van
      <span class="totalPages"></span>
    </p>
    `
  });

  await browser.close();

  return buffer;
}

function formatNumber(number) {
  // Check if the number is a round number
  const isRound = Number.isInteger(number);

  // Convert number to a string
  let formattedNumber = number.toString();

  // Split the number into integer and decimal parts
  const parts = formattedNumber.split('.');

  // Format the integer part with commas for thousands
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // If there is a decimal part, format it
  if (parts[1]) {
    // Pad the decimal part with zeros if it has only one digit
    parts[1] = ',' + (parts[1].length === 1 ? parts[1] + '0' : parts[1]);
  } else {
    // If the number is round, add ',00' for round numbers
    parts[1] = isRound ? ',00' : '';
  }

  // Join the integer and decimal parts and return the formatted number
  formattedNumber = parts.join('');

  return formattedNumber;
}

function generateAllocationsTable(allocations) {
  let res = '';
  for (const allocation of allocations) {
    res += `
      <tr>
          <td style="width: 80px; vertical-align: top; line-height: 10px; font-family: 'IBM Plex Mono'" align="left">${allocation.invoice_date}</td>
          <td style="width: 76px; vertical-align: top; line-height: 10px; font-family: 'IBM Plex Mono'" align="left">${allocation.invoice_number}</td>
          <td style="width: 76px; vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left">${allocation.supplier_name}</td>
          <td style="width: 140px; vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left">${allocation.description}</td>
          <td style="width: 72px; vertical-align: top; padding-right: 8px; line-height: 10px; font-family: 'IBM Plex Mono'" align="right">&euro;${formatNumber(allocation.vat_amount)}</td>
          <td style="width: 72px; vertical-align: top; padding-left: 4px; line-height: 10px; font-family: 'IBM Plex Mono'" align="right" >&euro;${formatNumber(allocation.total)}</td>
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
          <td colspan="6" style="font-weight: 600; font-family: 'Inter'">
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
    @import url(https://fonts.googleapis.com/css?family=Inter)
    @import url(https://fonts.googleapis.com/css?family=IBM Plex Mono)
    @page {
      margin: 15px;
    }
    body {
      font-family: 'Inter';
    }
    @font-face {
      font-family: 'IBM Plex Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1iIq129k.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'IBM Plex Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1isq129k.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* vietnamese */
    @font-face {
      font-family: 'IBM Plex Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1iAq129k.woff2) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'IBM Plex Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1iEq129k.woff2) format('woff2');
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'IBM Plex Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* cyrillic-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhiI2B.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZthiI2B.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* greek-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZNhiI2B.woff2) format('woff2');
      unicode-range: U+1F00-1FFF;
    }
    /* greek */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZxhiI2B.woff2) format('woff2');
      unicode-range: U+0370-03FF;
    }
    /* vietnamese */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZBhiI2B.woff2) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZFhiI2B.woff2) format('woff2');
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
  </style>
  <body style="display: flex; justify-content: center; align-items: center">
    <div style="margin: 10px; width: 595px; height: 842px" className='invoice'>
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
              <p style="font-weight: 600; margin: 4px 0">${building_name}</p>
              <p style="margin: 4px 0">${company_number}</p>
              <p style="margin: 4px 0">${address_line_1}</p>
              <p style="margin: 4px 0">${address_line_2}</p>
            </div>
            <div style="width: 33%" align="center">
              <p style="font-weight: 600; margin: 4px 0">Facturenlijst - grootboekrekening</p>
              <p style="margin: 4px 0">${date_start} - ${date_end}</p>
            </div>
            <div style="width: 33%" align="right">
              <p style="font-weight: 600; margin: 4px 0">${export_date}</p>
            </div>
          </div>
          <div>
            <table
              style="
                width: 100%;
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
                    font-weight: 600;
                  "
                  align="left"
                >
                  Datum
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="left"
                >
                  Factuurnr.
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="left"
                >
                  Leverancier.
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
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
                    font-weight: 600;
                    font-family: 'Inter';
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
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="right"
                >
                  Totaal
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
                  font-weight: 600;
                "
                align="left"
              >
                Totaal
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-right: 8px;
                  font-weight: 600;
                  font-family: 'IBM Plex Mono'
                "
                align="right"
              >
                &euro;${formatNumber(sum_vat_amount)}
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-left: 4px;
                  font-weight: 600;
                  font-family: 'IBM Plex Mono'
                "
                align="right"
              >
                &euro;${formatNumber(sum_total_amount)}
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
