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
    let
        doView index label =
            if label == "--" then
                viewSeparator

            else
                viewItem
                    (config.activateItem <| Just ( index, label ))
                    (config.activateItem Nothing)
                    (active == Just index)
                    label
    in
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
        (List.indexedMap doView config.items)


viewSeparator : Element.Element msg
viewSeparator =
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


viewItem : msg -> msg -> Bool -> String -> Element.Element msg
viewItem msgEnter msgLeave isActive label =
    let
        color =
            if isActive then
                Element.rgb255 170 170 170

            else
                Element.rgb255 255 255 255
    in
    Element.el
        [ Element.width Element.fill
        , Events.onMouseEnter msgEnter
        , Events.onMouseLeave msgLeave
        , Element.paddingXY 16 4
        , Background.color color
        ]
        (Element.text label)
