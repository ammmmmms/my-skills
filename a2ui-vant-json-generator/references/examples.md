# Examples

## Simple Form Card

```json
{
  "messages": [
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "profile-form",
        "catalogId": "urn:a2ui:catalog:vant:v1",
        "sendDataModel": true
      }
    },
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "profile-form",
        "components": [
          { "id": "root", "component": "Card", "child": "content" },
          { "id": "content", "component": "Column", "children": ["title", "name-field", "submit"] },
          { "id": "title", "component": "Text", "text": "编辑资料", "variant": "h3" },
          {
            "id": "name-field",
            "component": "TextField",
            "label": "姓名",
            "value": { "path": "/profile/name" },
            "action": {
              "event": {
                "name": "name_blur",
                "context": {
                  "name": { "path": "/profile/name" }
                }
              }
            }
          },
          {
            "id": "submit",
            "component": "Button",
            "label": "保存",
            "variant": "primary",
            "action": {
              "event": {
                "name": "save_profile",
                "context": {
                  "name": { "path": "/profile/name" }
                }
              }
            }
          }
        ]
      }
    },
    {
      "version": "v0.9",
      "updateDataModel": {
        "surfaceId": "profile-form",
        "value": {
          "profile": {
            "name": "Lee"
          }
        }
      }
    }
  ]
}
```

## Array Template List Card

```json
{
  "messages": [
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "product-list-demo",
        "catalogId": "urn:a2ui:catalog:vant:v1",
        "sendDataModel": true
      }
    },
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "product-list-demo",
        "components": [
          { "id": "root", "component": "Column", "children": ["page-title", "product-list"] },
          { "id": "page-title", "component": "Text", "text": "商品列表", "variant": "h3" },
          {
            "id": "product-list",
            "component": "List",
            "children": {
              "componentId": "product-card",
              "path": "/products"
            }
          },
          {
            "id": "product-card",
            "component": "Card",
            "child": "product-card-content",
            "style": {
              "backgroundColor": "#f8fafc",
              "border": "1px solid #dbe4ee",
              "padding": "16px",
              "borderRadius": "16px"
            }
          },
          { "id": "product-card-content", "component": "Column", "children": ["product-name", "product-price", "product-desc", "buy-button"] },
          { "id": "product-name", "component": "Text", "text": { "path": "name" }, "variant": "h4" },
          { "id": "product-price", "component": "Text", "text": { "path": "priceText" }, "variant": "body" },
          { "id": "product-desc", "component": "Text", "text": { "path": "description" }, "variant": "caption" },
          {
            "id": "buy-button",
            "component": "Button",
            "label": "加入购物车",
            "variant": "primary",
            "action": {
              "event": {
                "name": "add_to_cart",
                "context": {
                  "productId": { "path": "id" },
                  "productName": { "path": "name" }
                }
              }
            }
          }
        ]
      }
    },
    {
      "version": "v0.9",
      "updateDataModel": {
        "surfaceId": "product-list-demo",
        "value": {
          "products": [
            {
              "id": "p-001",
              "name": "拿铁",
              "priceText": "¥28",
              "description": "奶香顺滑，适合早餐"
            },
            {
              "id": "p-002",
              "name": "美式",
              "priceText": "¥22",
              "description": "口感更干净，偏苦"
            }
          ]
        }
      }
    }
  ]
}
```

## Nested List With Object Array

```json
{
  "messages": [
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "nested-list-demo",
        "catalogId": "urn:a2ui:catalog:vant:v1",
        "sendDataModel": true
      }
    },
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "nested-list-demo",
        "components": [
          { "id": "root", "component": "List", "children": { "componentId": "product-card", "path": "/products" } },
          {
            "id": "product-card",
            "component": "Card",
            "child": "product-card-content",
            "style": {
              "backgroundColor": "#ffffff",
              "border": "1px solid #dbe4ee",
              "padding": "16px",
              "borderRadius": "16px",
              "marginBottom": "12px"
            }
          },
          { "id": "product-card-content", "component": "Column", "children": ["product-name", "tag-list"] },
          { "id": "product-name", "component": "Text", "text": { "path": "name" }, "variant": "h4" },
          {
            "id": "tag-list",
            "component": "List",
            "children": {
              "componentId": "tag-item",
              "path": "tags"
            }
          },
          { "id": "tag-item", "component": "Row", "align": "center", "children": ["tag-icon", "tag-copy"] },
          { "id": "tag-icon", "component": "Icon", "name": { "path": "icon" }, "size": 14, "type": "primary" },
          { "id": "tag-copy", "component": "Column", "children": ["tag-label", "tag-detail"] },
          { "id": "tag-label", "component": "Text", "text": { "path": "label" }, "variant": "body" },
          { "id": "tag-detail", "component": "Text", "text": { "path": "detail" }, "variant": "caption" }
        ]
      }
    },
    {
      "version": "v0.9",
      "updateDataModel": {
        "surfaceId": "nested-list-demo",
        "value": {
          "products": [
            {
              "name": "燕麦拿铁",
              "tags": [
                { "label": "热销", "detail": "近7天销量最高", "icon": "fire-o" },
                { "label": "奶香", "detail": "口感更顺滑", "icon": "like-o" }
              ]
            }
          ]
        }
      }
    }
  ]
}
```
