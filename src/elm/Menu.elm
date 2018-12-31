module Menu exposing (Config, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events



-- MODEL


type alias Config msg =
    { items : List String
    , activateItem : Maybe ( Int, String ) -> msg
    , selectCurrentItem : msg
    }



-- VIEW


view : Config msg -> Maybe Int -> Element.Element msg
view config active =
    Element.column
        [ Element.alignLeft
        , Element.paddingXY 0 4
        , Background.color <| Element.rgb255 255 255 255
        , Border.color <| Element.rgb255 170 170 170
        , Border.width 1
        , Border.shadow
            { offset = ( 0.0, 8.0 )
            , size = 0.0
            , blur = 16.0
            , color = Element.rgba 0.0 0.0 0.0 0.2
            }
        , Events.onClick config.selectCurrentItem
        ]
        (List.indexedMap (viewItem config active) config.items)


viewItem : Config msg -> Maybe Int -> Int -> String -> Element.Element msg
viewItem config active index label =
    if label == "--" then
        Element.el
            [ Element.width Element.fill
            , Element.paddingXY 0 4
            ]
            (Element.el
                [ Element.width Element.fill
                , Border.color <| Element.rgb255 170 170 170
                , Border.widthEach { bottom = 1, top = 0, left = 0, right = 0 }
                ]
                Element.none
            )

    else
        Element.el
            [ Element.width Element.fill
            , Events.onMouseEnter <| config.activateItem (Just ( index, label ))
            , Events.onMouseLeave <| config.activateItem Nothing
            , Events.onClick config.selectCurrentItem
            , Element.paddingXY 16 4
            , Background.color
                (if active == Just index then
                    Element.rgb255 170 170 170

                 else
                    Element.rgb255 255 255 255
                )
            ]
            (Element.text label)
