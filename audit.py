import json
import decimal

with open('results.json', 'r') as f:
    data = json.load(f)

divergent = []
for r in data:
    bruto = decimal.Decimal(str(r.get('valor_bruto') or 0))
    limpeza = decimal.Decimal(str(r.get('taxa_limpeza') or 0))
    plataforma = decimal.Decimal(str(r.get('comissao_plataforma') or 0))
    stored_payout = decimal.Decimal(str(r.get('stored_payout') or 0))
    
    if bruto == 0: continue
    
    liquido = bruto - limpeza - plataforma
    if liquido <= 0: continue
    
    # Current dynamic rate logic
    rate = decimal.Decimal('0.25') # default
    if r.get('taxa_comissao_reserva') is not None:
        rate = decimal.Decimal(str(r['taxa_comissao_reserva'])) / 100
    elif r.get('imovel_rate') is not None:
        rate = decimal.Decimal(str(r['imovel_rate'])) / 100
    elif r.get('owner_rate') is not None:
        rate = decimal.Decimal(str(r['owner_rate'])) / 100
    elif r.get('admin_default_rate') is not None:
        rate = decimal.Decimal(str(r['admin_default_rate']))
        
    calculated_payout = liquido * (1 - rate)
    
    diff = abs(stored_payout - calculated_payout)
    if diff > decimal.Decimal('0.05'): # allow for small rounding
        divergent.append({
            'id': r['id'],
            'nome': r['nome_hospede'],
            'data': r['data_inicio'],
            'stored': float(stored_payout),
            'calculated': float(calculated_payout),
            'diff': float(diff),
            'implied_rate': float((liquido - stored_payout) / liquido)
        })

print(json.dumps(divergent, indent=2))
