export interface PhoneCountry {
  code: string;      // ISO 3166-1 alpha-2
  dialCode: string;  // Indicatif international
  name: string;      // Nom en francais
  flag: string;      // Emoji drapeau
}

// Côte d'Ivoire is the default for new registrations and phone inputs.
// Deployments can still override it through EXPO_PUBLIC_DEFAULT_COUNTRY_CODE.
export const DEFAULT_COUNTRY_CODE = process.env.EXPO_PUBLIC_DEFAULT_COUNTRY_CODE || 'CI';

/** Liste complete des pays avec indicatifs telephoniques */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'AF', dialCode: '+93', name: 'Afghanistan', flag: '\u{1F1E6}\u{1F1EB}' },
  { code: 'ZA', dialCode: '+27', name: 'Afrique du Sud', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: 'AL', dialCode: '+355', name: 'Albanie', flag: '\u{1F1E6}\u{1F1F1}' },
  { code: 'DZ', dialCode: '+213', name: 'Alg\u00e9rie', flag: '\u{1F1E9}\u{1F1FF}' },
  { code: 'DE', dialCode: '+49', name: 'Allemagne', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'AD', dialCode: '+376', name: 'Andorre', flag: '\u{1F1E6}\u{1F1E9}' },
  { code: 'AO', dialCode: '+244', name: 'Angola', flag: '\u{1F1E6}\u{1F1F4}' },
  { code: 'AG', dialCode: '+1268', name: 'Antigua-et-Barbuda', flag: '\u{1F1E6}\u{1F1EC}' },
  { code: 'SA', dialCode: '+966', name: 'Arabie saoudite', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'AR', dialCode: '+54', name: 'Argentine', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: 'AM', dialCode: '+374', name: 'Arm\u00e9nie', flag: '\u{1F1E6}\u{1F1F2}' },
  { code: 'AU', dialCode: '+61', name: 'Australie', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: 'AT', dialCode: '+43', name: 'Autriche', flag: '\u{1F1E6}\u{1F1F9}' },
  { code: 'AZ', dialCode: '+994', name: 'Azerba\u00efdjan', flag: '\u{1F1E6}\u{1F1FF}' },
  { code: 'BS', dialCode: '+1242', name: 'Bahamas', flag: '\u{1F1E7}\u{1F1F8}' },
  { code: 'BH', dialCode: '+973', name: 'Bahre\u00efn', flag: '\u{1F1E7}\u{1F1ED}' },
  { code: 'BD', dialCode: '+880', name: 'Bangladesh', flag: '\u{1F1E7}\u{1F1E9}' },
  { code: 'BB', dialCode: '+1246', name: 'Barbade', flag: '\u{1F1E7}\u{1F1E7}' },
  { code: 'BE', dialCode: '+32', name: 'Belgique', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'BZ', dialCode: '+501', name: 'Belize', flag: '\u{1F1E7}\u{1F1FF}' },
  { code: 'BJ', dialCode: '+229', name: 'B\u00e9nin', flag: '\u{1F1E7}\u{1F1EF}' },
  { code: 'BT', dialCode: '+975', name: 'Bhoutan', flag: '\u{1F1E7}\u{1F1F9}' },
  { code: 'BY', dialCode: '+375', name: 'Bi\u00e9lorussie', flag: '\u{1F1E7}\u{1F1FE}' },
  { code: 'BO', dialCode: '+591', name: 'Bolivie', flag: '\u{1F1E7}\u{1F1F4}' },
  { code: 'BA', dialCode: '+387', name: 'Bosnie-Herz\u00e9govine', flag: '\u{1F1E7}\u{1F1E6}' },
  { code: 'BW', dialCode: '+267', name: 'Botswana', flag: '\u{1F1E7}\u{1F1FC}' },
  { code: 'BR', dialCode: '+55', name: 'Br\u00e9sil', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'BN', dialCode: '+673', name: 'Brunei', flag: '\u{1F1E7}\u{1F1F3}' },
  { code: 'BG', dialCode: '+359', name: 'Bulgarie', flag: '\u{1F1E7}\u{1F1EC}' },
  { code: 'BF', dialCode: '+226', name: 'Burkina Faso', flag: '\u{1F1E7}\u{1F1EB}' },
  { code: 'BI', dialCode: '+257', name: 'Burundi', flag: '\u{1F1E7}\u{1F1EE}' },
  { code: 'KH', dialCode: '+855', name: 'Cambodge', flag: '\u{1F1F0}\u{1F1ED}' },
  { code: 'CM', dialCode: '+237', name: 'Cameroun', flag: '\u{1F1E8}\u{1F1F2}' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}' },
  { code: 'CV', dialCode: '+238', name: 'Cap-Vert', flag: '\u{1F1E8}\u{1F1FB}' },
  { code: 'CF', dialCode: '+236', name: 'Centrafrique', flag: '\u{1F1E8}\u{1F1EB}' },
  { code: 'CL', dialCode: '+56', name: 'Chili', flag: '\u{1F1E8}\u{1F1F1}' },
  { code: 'CN', dialCode: '+86', name: 'Chine', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'CY', dialCode: '+357', name: 'Chypre', flag: '\u{1F1E8}\u{1F1FE}' },
  { code: 'CO', dialCode: '+57', name: 'Colombie', flag: '\u{1F1E8}\u{1F1F4}' },
  { code: 'KM', dialCode: '+269', name: 'Comores', flag: '\u{1F1F0}\u{1F1F2}' },
  { code: 'CG', dialCode: '+242', name: 'Congo', flag: '\u{1F1E8}\u{1F1EC}' },
  { code: 'CD', dialCode: '+243', name: 'Congo (RDC)', flag: '\u{1F1E8}\u{1F1E9}' },
  { code: 'KR', dialCode: '+82', name: 'Cor\u00e9e du Sud', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'KP', dialCode: '+850', name: 'Cor\u00e9e du Nord', flag: '\u{1F1F0}\u{1F1F5}' },
  { code: 'CR', dialCode: '+506', name: 'Costa Rica', flag: '\u{1F1E8}\u{1F1F7}' },
  { code: 'CI', dialCode: '+225', name: 'C\u00f4te d\'Ivoire', flag: '\u{1F1E8}\u{1F1EE}' },
  { code: 'HR', dialCode: '+385', name: 'Croatie', flag: '\u{1F1ED}\u{1F1F7}' },
  { code: 'CU', dialCode: '+53', name: 'Cuba', flag: '\u{1F1E8}\u{1F1FA}' },
  { code: 'DK', dialCode: '+45', name: 'Danemark', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: 'DJ', dialCode: '+253', name: 'Djibouti', flag: '\u{1F1E9}\u{1F1EF}' },
  { code: 'DM', dialCode: '+1767', name: 'Dominique', flag: '\u{1F1E9}\u{1F1F2}' },
  { code: 'EG', dialCode: '+20', name: '\u00c9gypte', flag: '\u{1F1EA}\u{1F1EC}' },
  { code: 'AE', dialCode: '+971', name: '\u00c9mirats arabes unis', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: 'EC', dialCode: '+593', name: '\u00c9quateur', flag: '\u{1F1EA}\u{1F1E8}' },
  { code: 'ER', dialCode: '+291', name: '\u00c9rythr\u00e9e', flag: '\u{1F1EA}\u{1F1F7}' },
  { code: 'ES', dialCode: '+34', name: 'Espagne', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'EE', dialCode: '+372', name: 'Estonie', flag: '\u{1F1EA}\u{1F1EA}' },
  { code: 'US', dialCode: '+1', name: '\u00c9tats-Unis', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'ET', dialCode: '+251', name: '\u00c9thiopie', flag: '\u{1F1EA}\u{1F1F9}' },
  { code: 'FJ', dialCode: '+679', name: 'Fidji', flag: '\u{1F1EB}\u{1F1EF}' },
  { code: 'FI', dialCode: '+358', name: 'Finlande', flag: '\u{1F1EB}\u{1F1EE}' },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'GA', dialCode: '+241', name: 'Gabon', flag: '\u{1F1EC}\u{1F1E6}' },
  { code: 'GM', dialCode: '+220', name: 'Gambie', flag: '\u{1F1EC}\u{1F1F2}' },
  { code: 'GE', dialCode: '+995', name: 'G\u00e9orgie', flag: '\u{1F1EC}\u{1F1EA}' },
  { code: 'GH', dialCode: '+233', name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}' },
  { code: 'GR', dialCode: '+30', name: 'Gr\u00e8ce', flag: '\u{1F1EC}\u{1F1F7}' },
  { code: 'GD', dialCode: '+1473', name: 'Grenade', flag: '\u{1F1EC}\u{1F1E9}' },
  { code: 'GT', dialCode: '+502', name: 'Guatemala', flag: '\u{1F1EC}\u{1F1F9}' },
  { code: 'GN', dialCode: '+224', name: 'Guin\u00e9e', flag: '\u{1F1EC}\u{1F1F3}' },
  { code: 'GW', dialCode: '+245', name: 'Guin\u00e9e-Bissau', flag: '\u{1F1EC}\u{1F1FC}' },
  { code: 'GQ', dialCode: '+240', name: 'Guin\u00e9e \u00e9quatoriale', flag: '\u{1F1EC}\u{1F1F6}' },
  { code: 'GY', dialCode: '+592', name: 'Guyana', flag: '\u{1F1EC}\u{1F1FE}' },
  { code: 'HT', dialCode: '+509', name: 'Ha\u00efti', flag: '\u{1F1ED}\u{1F1F9}' },
  { code: 'HN', dialCode: '+504', name: 'Honduras', flag: '\u{1F1ED}\u{1F1F3}' },
  { code: 'HU', dialCode: '+36', name: 'Hongrie', flag: '\u{1F1ED}\u{1F1FA}' },
  { code: 'IN', dialCode: '+91', name: 'Inde', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'ID', dialCode: '+62', name: 'Indon\u00e9sie', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'IQ', dialCode: '+964', name: 'Irak', flag: '\u{1F1EE}\u{1F1F6}' },
  { code: 'IR', dialCode: '+98', name: 'Iran', flag: '\u{1F1EE}\u{1F1F7}' },
  { code: 'IE', dialCode: '+353', name: 'Irlande', flag: '\u{1F1EE}\u{1F1EA}' },
  { code: 'IS', dialCode: '+354', name: 'Islande', flag: '\u{1F1EE}\u{1F1F8}' },
  { code: 'IL', dialCode: '+972', name: 'Isra\u00ebl', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'IT', dialCode: '+39', name: 'Italie', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'JM', dialCode: '+1876', name: 'Jama\u00efque', flag: '\u{1F1EF}\u{1F1F2}' },
  { code: 'JP', dialCode: '+81', name: 'Japon', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'JO', dialCode: '+962', name: 'Jordanie', flag: '\u{1F1EF}\u{1F1F4}' },
  { code: 'KZ', dialCode: '+7', name: 'Kazakhstan', flag: '\u{1F1F0}\u{1F1FF}' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '\u{1F1F0}\u{1F1EA}' },
  { code: 'KG', dialCode: '+996', name: 'Kirghizistan', flag: '\u{1F1F0}\u{1F1EC}' },
  { code: 'KW', dialCode: '+965', name: 'Kowe\u00eft', flag: '\u{1F1F0}\u{1F1FC}' },
  { code: 'LA', dialCode: '+856', name: 'Laos', flag: '\u{1F1F1}\u{1F1E6}' },
  { code: 'LS', dialCode: '+266', name: 'Lesotho', flag: '\u{1F1F1}\u{1F1F8}' },
  { code: 'LV', dialCode: '+371', name: 'Lettonie', flag: '\u{1F1F1}\u{1F1FB}' },
  { code: 'LB', dialCode: '+961', name: 'Liban', flag: '\u{1F1F1}\u{1F1E7}' },
  { code: 'LR', dialCode: '+231', name: 'Lib\u00e9ria', flag: '\u{1F1F1}\u{1F1F7}' },
  { code: 'LY', dialCode: '+218', name: 'Libye', flag: '\u{1F1F1}\u{1F1FE}' },
  { code: 'LI', dialCode: '+423', name: 'Liechtenstein', flag: '\u{1F1F1}\u{1F1EE}' },
  { code: 'LT', dialCode: '+370', name: 'Lituanie', flag: '\u{1F1F1}\u{1F1F9}' },
  { code: 'LU', dialCode: '+352', name: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}' },
  { code: 'MK', dialCode: '+389', name: 'Mac\u00e9doine du Nord', flag: '\u{1F1F2}\u{1F1F0}' },
  { code: 'MG', dialCode: '+261', name: 'Madagascar', flag: '\u{1F1F2}\u{1F1EC}' },
  { code: 'MY', dialCode: '+60', name: 'Malaisie', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'MW', dialCode: '+265', name: 'Malawi', flag: '\u{1F1F2}\u{1F1FC}' },
  { code: 'MV', dialCode: '+960', name: 'Maldives', flag: '\u{1F1F2}\u{1F1FB}' },
  { code: 'ML', dialCode: '+223', name: 'Mali', flag: '\u{1F1F2}\u{1F1F1}' },
  { code: 'MT', dialCode: '+356', name: 'Malte', flag: '\u{1F1F2}\u{1F1F9}' },
  { code: 'MA', dialCode: '+212', name: 'Maroc', flag: '\u{1F1F2}\u{1F1E6}' },
  { code: 'MU', dialCode: '+230', name: 'Maurice', flag: '\u{1F1F2}\u{1F1FA}' },
  { code: 'MR', dialCode: '+222', name: 'Mauritanie', flag: '\u{1F1F2}\u{1F1F7}' },
  { code: 'MX', dialCode: '+52', name: 'Mexique', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'MD', dialCode: '+373', name: 'Moldavie', flag: '\u{1F1F2}\u{1F1E9}' },
  { code: 'MC', dialCode: '+377', name: 'Monaco', flag: '\u{1F1F2}\u{1F1E8}' },
  { code: 'MN', dialCode: '+976', name: 'Mongolie', flag: '\u{1F1F2}\u{1F1F3}' },
  { code: 'ME', dialCode: '+382', name: 'Mont\u00e9n\u00e9gro', flag: '\u{1F1F2}\u{1F1EA}' },
  { code: 'MZ', dialCode: '+258', name: 'Mozambique', flag: '\u{1F1F2}\u{1F1FF}' },
  { code: 'MM', dialCode: '+95', name: 'Myanmar', flag: '\u{1F1F2}\u{1F1F2}' },
  { code: 'NA', dialCode: '+264', name: 'Namibie', flag: '\u{1F1F3}\u{1F1E6}' },
  { code: 'NP', dialCode: '+977', name: 'N\u00e9pal', flag: '\u{1F1F3}\u{1F1F5}' },
  { code: 'NI', dialCode: '+505', name: 'Nicaragua', flag: '\u{1F1F3}\u{1F1EE}' },
  { code: 'NE', dialCode: '+227', name: 'Niger', flag: '\u{1F1F3}\u{1F1EA}' },
  { code: 'NG', dialCode: '+234', name: 'Nig\u00e9ria', flag: '\u{1F1F3}\u{1F1EC}' },
  { code: 'NO', dialCode: '+47', name: 'Norv\u00e8ge', flag: '\u{1F1F3}\u{1F1F4}' },
  { code: 'NZ', dialCode: '+64', name: 'Nouvelle-Z\u00e9lande', flag: '\u{1F1F3}\u{1F1FF}' },
  { code: 'OM', dialCode: '+968', name: 'Oman', flag: '\u{1F1F4}\u{1F1F2}' },
  { code: 'UG', dialCode: '+256', name: 'Ouganda', flag: '\u{1F1FA}\u{1F1EC}' },
  { code: 'UZ', dialCode: '+998', name: 'Ouzb\u00e9kistan', flag: '\u{1F1FA}\u{1F1FF}' },
  { code: 'PK', dialCode: '+92', name: 'Pakistan', flag: '\u{1F1F5}\u{1F1F0}' },
  { code: 'PA', dialCode: '+507', name: 'Panama', flag: '\u{1F1F5}\u{1F1E6}' },
  { code: 'PG', dialCode: '+675', name: 'Papouasie-Nouvelle-Guin\u00e9e', flag: '\u{1F1F5}\u{1F1EC}' },
  { code: 'PY', dialCode: '+595', name: 'Paraguay', flag: '\u{1F1F5}\u{1F1FE}' },
  { code: 'NL', dialCode: '+31', name: 'Pays-Bas', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'PE', dialCode: '+51', name: 'P\u00e9rou', flag: '\u{1F1F5}\u{1F1EA}' },
  { code: 'PH', dialCode: '+63', name: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'PL', dialCode: '+48', name: 'Pologne', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'PT', dialCode: '+351', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'QA', dialCode: '+974', name: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}' },
  { code: 'DO', dialCode: '+1809', name: 'R\u00e9publique dominicaine', flag: '\u{1F1E9}\u{1F1F4}' },
  { code: 'CZ', dialCode: '+420', name: 'R\u00e9publique tch\u00e8que', flag: '\u{1F1E8}\u{1F1FF}' },
  { code: 'RO', dialCode: '+40', name: 'Roumanie', flag: '\u{1F1F7}\u{1F1F4}' },
  { code: 'GB', dialCode: '+44', name: 'Royaume-Uni', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'RU', dialCode: '+7', name: 'Russie', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'RW', dialCode: '+250', name: 'Rwanda', flag: '\u{1F1F7}\u{1F1FC}' },
  { code: 'KN', dialCode: '+1869', name: 'Saint-Kitts-et-Nevis', flag: '\u{1F1F0}\u{1F1F3}' },
  { code: 'LC', dialCode: '+1758', name: 'Sainte-Lucie', flag: '\u{1F1F1}\u{1F1E8}' },
  { code: 'VC', dialCode: '+1784', name: 'Saint-Vincent-et-les-Grenadines', flag: '\u{1F1FB}\u{1F1E8}' },
  { code: 'SV', dialCode: '+503', name: 'Salvador', flag: '\u{1F1F8}\u{1F1FB}' },
  { code: 'WS', dialCode: '+685', name: 'Samoa', flag: '\u{1F1FC}\u{1F1F8}' },
  { code: 'ST', dialCode: '+239', name: 'Sao Tom\u00e9-et-Pr\u00edncipe', flag: '\u{1F1F8}\u{1F1F9}' },
  { code: 'SN', dialCode: '+221', name: 'S\u00e9n\u00e9gal', flag: '\u{1F1F8}\u{1F1F3}' },
  { code: 'RS', dialCode: '+381', name: 'Serbie', flag: '\u{1F1F7}\u{1F1F8}' },
  { code: 'SC', dialCode: '+248', name: 'Seychelles', flag: '\u{1F1F8}\u{1F1E8}' },
  { code: 'SL', dialCode: '+232', name: 'Sierra Leone', flag: '\u{1F1F8}\u{1F1F1}' },
  { code: 'SG', dialCode: '+65', name: 'Singapour', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: 'SK', dialCode: '+421', name: 'Slovaquie', flag: '\u{1F1F8}\u{1F1F0}' },
  { code: 'SI', dialCode: '+386', name: 'Slov\u00e9nie', flag: '\u{1F1F8}\u{1F1EE}' },
  { code: 'SO', dialCode: '+252', name: 'Somalie', flag: '\u{1F1F8}\u{1F1F4}' },
  { code: 'SD', dialCode: '+249', name: 'Soudan', flag: '\u{1F1F8}\u{1F1E9}' },
  { code: 'SS', dialCode: '+211', name: 'Soudan du Sud', flag: '\u{1F1F8}\u{1F1F8}' },
  { code: 'LK', dialCode: '+94', name: 'Sri Lanka', flag: '\u{1F1F1}\u{1F1F0}' },
  { code: 'SE', dialCode: '+46', name: 'Su\u00e8de', flag: '\u{1F1F8}\u{1F1EA}' },
  { code: 'CH', dialCode: '+41', name: 'Suisse', flag: '\u{1F1E8}\u{1F1ED}' },
  { code: 'SR', dialCode: '+597', name: 'Suriname', flag: '\u{1F1F8}\u{1F1F7}' },
  { code: 'SZ', dialCode: '+268', name: 'Eswatini', flag: '\u{1F1F8}\u{1F1FF}' },
  { code: 'SY', dialCode: '+963', name: 'Syrie', flag: '\u{1F1F8}\u{1F1FE}' },
  { code: 'TJ', dialCode: '+992', name: 'Tadjikistan', flag: '\u{1F1F9}\u{1F1EF}' },
  { code: 'TZ', dialCode: '+255', name: 'Tanzanie', flag: '\u{1F1F9}\u{1F1FF}' },
  { code: 'TD', dialCode: '+235', name: 'Tchad', flag: '\u{1F1F9}\u{1F1E9}' },
  { code: 'TH', dialCode: '+66', name: 'Tha\u00eflande', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: 'TL', dialCode: '+670', name: 'Timor oriental', flag: '\u{1F1F9}\u{1F1F1}' },
  { code: 'TG', dialCode: '+228', name: 'Togo', flag: '\u{1F1F9}\u{1F1EC}' },
  { code: 'TO', dialCode: '+676', name: 'Tonga', flag: '\u{1F1F9}\u{1F1F4}' },
  { code: 'TT', dialCode: '+1868', name: 'Trinit\u00e9-et-Tobago', flag: '\u{1F1F9}\u{1F1F9}' },
  { code: 'TN', dialCode: '+216', name: 'Tunisie', flag: '\u{1F1F9}\u{1F1F3}' },
  { code: 'TM', dialCode: '+993', name: 'Turkm\u00e9nistan', flag: '\u{1F1F9}\u{1F1F2}' },
  { code: 'TR', dialCode: '+90', name: 'Turquie', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: 'UA', dialCode: '+380', name: 'Ukraine', flag: '\u{1F1FA}\u{1F1E6}' },
  { code: 'UY', dialCode: '+598', name: 'Uruguay', flag: '\u{1F1FA}\u{1F1FE}' },
  { code: 'VU', dialCode: '+678', name: 'Vanuatu', flag: '\u{1F1FB}\u{1F1FA}' },
  { code: 'VE', dialCode: '+58', name: 'Venezuela', flag: '\u{1F1FB}\u{1F1EA}' },
  { code: 'VN', dialCode: '+84', name: 'Vi\u00eat Nam', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: 'YE', dialCode: '+967', name: 'Y\u00e9men', flag: '\u{1F1FE}\u{1F1EA}' },
  { code: 'ZM', dialCode: '+260', name: 'Zambie', flag: '\u{1F1FF}\u{1F1F2}' },
  { code: 'ZW', dialCode: '+263', name: 'Zimbabwe', flag: '\u{1F1FF}\u{1F1FC}' },
].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Pays favoris affiches en premier dans le selecteur, configurables par environnement. */
const FAVORITE_COUNTRY_CODES = (process.env.EXPO_PUBLIC_FAVORITE_COUNTRY_CODES || '')
  .split(',')
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

export const FAVORITE_COUNTRIES: PhoneCountry[] = PHONE_COUNTRIES.filter(
  (c) => FAVORITE_COUNTRY_CODES.includes(c.code)
).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Recherche par code ISO */
export function getCountryByCode(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.code === code);
}

/** Recherche par indicatif (ex: '+225') — retourne le premier match */
export function getCountryByDialCode(dialCode: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.dialCode === dialCode);
}

/**
 * Parse une valeur E.164 en { country, localNumber }.
 * Trie par longueur de dialCode decroissante pour matcher le plus specifique d'abord.
 */
export function parseE164(value: string, defaultCountryCode: string = DEFAULT_COUNTRY_CODE): { country: PhoneCountry; localNumber: string } {
  const defaultCountry = getCountryByCode(defaultCountryCode) || PHONE_COUNTRIES[0];

  if (!value || !value.startsWith('+')) {
    return { country: defaultCountry, localNumber: value || '' };
  }

  // Trier par longueur decroissante pour matcher le dialCode le plus long d'abord
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    if (value.startsWith(c.dialCode)) {
      return { country: c, localNumber: value.slice(c.dialCode.length) };
    }
  }

  return { country: defaultCountry, localNumber: value };
}
