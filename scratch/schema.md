# Rexermi DB Schema Info

## Table: admin_users

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| username | varchar(50) | NO | UNI | null |  |
| password | varchar(255) | NO |  | null |  |
| full_name | varchar(100) | NO |  | null |  |
| email | varchar(100) | YES |  | null |  |
| created_at | timestamp | NO |  | current_timestamp() |  |

## Table: cart

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| session_id | varchar(100) | NO |  | null |  |
| user_id | int(11) | YES | MUL | null |  |
| product_id | int(11) | NO | MUL | null |  |
| quantity | int(11) | NO |  | 1 |  |
| added_at | timestamp | NO |  | current_timestamp() |  |

## Table: categories

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| name | varchar(100) | NO |  | null |  |
| slug | varchar(100) | NO | UNI | null |  |
| description | text | YES |  | null |  |
| icon | varchar(50) | YES |  | box |  |
| is_active | tinyint(1) | YES |  | 1 |  |
| sort_order | int(11) | YES |  | 0 |  |
| created_at | timestamp | NO |  | current_timestamp() |  |

## Table: coupons

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| code | varchar(50) | NO | UNI | null |  |
| discount_type | enum('percent','fixed') | NO |  | percent |  |
| discount_value | decimal(10,2) | NO |  | null |  |
| min_order | decimal(10,2) | YES |  | 0.00 |  |
| uses_left | int(11) | YES |  | null |  |
| is_active | tinyint(1) | YES |  | 1 |  |
| expires_at | datetime | YES |  | null |  |
| created_at | timestamp | NO |  | current_timestamp() |  |

## Table: messages

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| user_id | int(11) | YES | MUL | null |  |
| name | varchar(100) | YES |  | null |  |
| email | varchar(100) | YES |  | null |  |
| subject | varchar(200) | YES |  | null |  |
| message | text | YES |  | null |  |
| is_read | tinyint(1) | YES |  | 0 |  |
| created_at | timestamp | NO |  | current_timestamp() |  |

## Table: order_items

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| order_id | int(11) | NO | MUL | null |  |
| product_id | int(11) | YES | MUL | null |  |
| product_name | varchar(200) | NO |  | null |  |
| price | decimal(10,2) | NO |  | null |  |
| quantity | int(11) | NO |  | null |  |
| subtotal | decimal(10,2) | NO |  | null |  |

## Table: orders

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| order_number | varchar(20) | NO | UNI | null |  |
| user_id | int(11) | NO | MUL | null |  |
| status | enum('pending','paid','processing','shipped','delivered','cancelled') | YES |  | pending |  |
| subtotal | decimal(10,2) | NO |  | null |  |
| shipping_cost | decimal(10,2) | YES |  | 0.00 |  |
| total | decimal(10,2) | NO |  | null |  |
| payment_method | varchar(100) | YES |  | null |  |
| payment_ref | varchar(200) | YES |  | null |  |
| payment_proof | varchar(255) | YES |  | null |  |
| customer_message | text | YES |  | null |  |
| shipping_address | text | YES |  | null |  |
| shipping_city | varchar(100) | YES |  | null |  |
| admin_notes | text | YES |  | null |  |
| created_at | timestamp | NO |  | current_timestamp() |  |
| updated_at | timestamp | NO |  | current_timestamp() | on update current_timestamp() |

## Table: product_images

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| product_id | int(11) | NO | MUL | null |  |
| image_url | varchar(255) | NO |  | null |  |
| sort_order | int(11) | YES |  | 0 |  |
| created_at | timestamp | NO |  | current_timestamp() |  |

## Table: products

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| category_id | int(11) | YES | MUL | null |  |
| name | varchar(200) | NO |  | null |  |
| slug | varchar(200) | NO | UNI | null |  |
| short_desc | text | YES |  | null |  |
| description | longtext | YES |  | null |  |
| price | decimal(10,2) | NO |  | 0.00 |  |
| stock | int(11) | YES |  | 0 |  |
| type | enum('product','service') | YES |  | product |  |
| image | varchar(255) | YES |  | null |  |
| image2 | varchar(255) | YES |  | null |  |
| image3 | varchar(255) | YES |  | null |  |
| is_featured | tinyint(1) | YES |  | 0 |  |
| is_active | tinyint(1) | YES |  | 1 |  |
| views | int(11) | YES |  | 0 |  |
| created_at | timestamp | NO |  | current_timestamp() |  |
| updated_at | timestamp | NO |  | current_timestamp() | on update current_timestamp() |

## Table: settings

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| key | varchar(100) | NO | UNI | null |  |
| value | text | YES |  | null |  |
| label | varchar(200) | YES |  | null |  |
| group | varchar(50) | YES |  | general |  |

## Table: users

| Field | Type | Null | Key | Default | Extra |
| --- | --- | --- | --- | --- | --- |
| id | int(11) | NO | PRI | null | auto_increment |
| full_name | varchar(100) | NO |  | null |  |
| email | varchar(100) | NO | UNI | null |  |
| password | varchar(255) | NO |  | null |  |
| phone | varchar(30) | YES |  | null |  |
| id_document | varchar(30) | YES |  | null |  |
| address | text | YES |  | null |  |
| city | varchar(100) | YES |  | null |  |
| state | varchar(100) | YES |  | null |  |
| country | varchar(100) | YES |  | Venezuela |  |
| postal_code | varchar(20) | YES |  | null |  |
| notes | text | YES |  | null |  |
| is_active | tinyint(1) | YES |  | 1 |  |
| created_at | timestamp | NO |  | current_timestamp() |  |
| updated_at | timestamp | NO |  | current_timestamp() | on update current_timestamp() |

